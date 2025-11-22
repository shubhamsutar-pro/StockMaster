import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { productId, warehouseId, newQuantity, reason, date } = await req.json();

    if (!productId || !warehouseId || newQuantity === undefined || !reason) {
      throw new Error('Missing required fields');
    }

    if (newQuantity < 0) {
      throw new Error('New quantity cannot be negative');
    }

    console.log('Processing stock adjustment:', { productId, warehouseId, newQuantity });

    // Get current stock
    const { data: stock } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', productId)
      .eq('warehouse_id', warehouseId)
      .maybeSingle();

    const previousQuantity = stock?.quantity || 0;

    // Create adjustment record
    const { data: adjustment, error: adjustmentError } = await supabase
      .from('stock_adjustments')
      .insert({
        product_id: productId,
        warehouse_id: warehouseId,
        previous_quantity: previousQuantity,
        new_quantity: newQuantity,
        reason,
        date: date || new Date().toISOString().split('T')[0],
        created_by: user.id,
      })
      .select()
      .single();

    if (adjustmentError) {
      throw new Error(`Failed to create adjustment: ${adjustmentError.message}`);
    }

    // Update or create stock record
    if (stock) {
      const { error: stockUpdateError } = await supabase
        .from('stock')
        .update({ quantity: newQuantity })
        .eq('id', stock.id);

      if (stockUpdateError) {
        throw new Error(`Failed to update stock: ${stockUpdateError.message}`);
      }
    } else {
      const { error: stockCreateError } = await supabase
        .from('stock')
        .insert({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: newQuantity,
        });

      if (stockCreateError) {
        throw new Error(`Failed to create stock: ${stockCreateError.message}`);
      }
    }

    // Insert movement record
    const { error: movementError } = await supabase
      .from('movements')
      .insert({
        product_id: productId,
        to_warehouse_id: warehouseId,
        quantity: newQuantity - previousQuantity,
        type: 'Adjustment',
        reference_id: adjustment.id,
        date: adjustment.date,
        created_by: user.id,
      });

    if (movementError) {
      throw new Error(`Failed to create movement: ${movementError.message}`);
    }

    console.log('Adjustment created successfully:', adjustment.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Adjustment created successfully', adjustment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating adjustment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
