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

    const { deliveryId } = await req.json();

    if (!deliveryId) {
      throw new Error('Delivery ID is required');
    }

    console.log('Processing delivery completion:', deliveryId);

    // Get delivery details
    const { data: delivery, error: deliveryError } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (deliveryError || !delivery) {
      throw new Error('Delivery order not found');
    }

    if (delivery.status === 'Completed') {
      throw new Error('Delivery order already completed');
    }

    // Check stock availability
    const { data: stock, error: stockError } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', delivery.product_id)
      .eq('warehouse_id', delivery.warehouse_id)
      .maybeSingle();

    if (stockError) {
      throw new Error(`Failed to check stock: ${stockError.message}`);
    }

    if (!stock) {
      throw new Error('No stock found for this product in this warehouse');
    }

    if (stock.quantity < delivery.quantity) {
      throw new Error(
        `Insufficient stock. Available: ${stock.quantity}, Required: ${delivery.quantity}`
      );
    }

    // Update delivery status
    const { error: updateError } = await supabase
      .from('delivery_orders')
      .update({ status: 'Completed' })
      .eq('id', deliveryId);

    if (updateError) {
      throw new Error(`Failed to update delivery order: ${updateError.message}`);
    }

    // Decrease stock
    const { error: stockUpdateError } = await supabase
      .from('stock')
      .update({ quantity: stock.quantity - delivery.quantity })
      .eq('id', stock.id);

    if (stockUpdateError) {
      throw new Error(`Failed to update stock: ${stockUpdateError.message}`);
    }

    // Insert movement record
    const { error: movementError } = await supabase
      .from('movements')
      .insert({
        product_id: delivery.product_id,
        from_warehouse_id: delivery.warehouse_id,
        quantity: delivery.quantity,
        type: 'Delivery',
        reference_id: deliveryId,
        date: delivery.date,
        created_by: user.id,
      });

    if (movementError) {
      throw new Error(`Failed to create movement: ${movementError.message}`);
    }

    console.log('Delivery completed successfully:', deliveryId);

    return new Response(
      JSON.stringify({ success: true, message: 'Delivery order completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error completing delivery:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
