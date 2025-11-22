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

    const { transferId } = await req.json();

    if (!transferId) {
      throw new Error('Transfer ID is required');
    }

    console.log('Processing transfer completion:', transferId);

    // Get transfer details
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select('*')
      .eq('id', transferId)
      .single();

    if (transferError || !transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status === 'Completed') {
      throw new Error('Transfer already completed');
    }

    // Check stock in source warehouse
    const { data: fromStock, error: fromStockError } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', transfer.product_id)
      .eq('warehouse_id', transfer.from_warehouse_id)
      .maybeSingle();

    if (fromStockError) {
      throw new Error(`Failed to check source stock: ${fromStockError.message}`);
    }

    if (!fromStock) {
      throw new Error('No stock found in source warehouse');
    }

    if (fromStock.quantity < transfer.quantity) {
      throw new Error(
        `Insufficient stock in source warehouse. Available: ${fromStock.quantity}, Required: ${transfer.quantity}`
      );
    }

    // Update transfer status
    const { error: updateError } = await supabase
      .from('transfers')
      .update({ status: 'Completed' })
      .eq('id', transferId);

    if (updateError) {
      throw new Error(`Failed to update transfer: ${updateError.message}`);
    }

    // Decrease stock from source warehouse
    const { error: fromStockUpdateError } = await supabase
      .from('stock')
      .update({ quantity: fromStock.quantity - transfer.quantity })
      .eq('id', fromStock.id);

    if (fromStockUpdateError) {
      throw new Error(`Failed to update source stock: ${fromStockUpdateError.message}`);
    }

    // Check if stock exists in destination warehouse
    const { data: toStock } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', transfer.product_id)
      .eq('warehouse_id', transfer.to_warehouse_id)
      .maybeSingle();

    if (toStock) {
      // Update existing stock in destination
      const { error: toStockUpdateError } = await supabase
        .from('stock')
        .update({ quantity: toStock.quantity + transfer.quantity })
        .eq('id', toStock.id);

      if (toStockUpdateError) {
        throw new Error(`Failed to update destination stock: ${toStockUpdateError.message}`);
      }
    } else {
      // Create new stock record in destination
      const { error: toStockCreateError } = await supabase
        .from('stock')
        .insert({
          product_id: transfer.product_id,
          warehouse_id: transfer.to_warehouse_id,
          quantity: transfer.quantity,
        });

      if (toStockCreateError) {
        throw new Error(`Failed to create destination stock: ${toStockCreateError.message}`);
      }
    }

    // Insert movement record
    const { error: movementError } = await supabase
      .from('movements')
      .insert({
        product_id: transfer.product_id,
        from_warehouse_id: transfer.from_warehouse_id,
        to_warehouse_id: transfer.to_warehouse_id,
        quantity: transfer.quantity,
        type: 'Transfer',
        reference_id: transferId,
        date: transfer.date,
        created_by: user.id,
      });

    if (movementError) {
      throw new Error(`Failed to create movement: ${movementError.message}`);
    }

    console.log('Transfer completed successfully:', transferId);

    return new Response(
      JSON.stringify({ success: true, message: 'Transfer completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error completing transfer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
