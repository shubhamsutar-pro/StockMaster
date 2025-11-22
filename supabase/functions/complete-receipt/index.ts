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

    const { receiptId } = await req.json();

    if (!receiptId) {
      throw new Error('Receipt ID is required');
    }

    console.log('Processing receipt completion:', receiptId);

    // Get receipt details
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      throw new Error('Receipt not found');
    }

    if (receipt.status === 'Completed') {
      throw new Error('Receipt already completed');
    }

    // Update receipt status to Completed
    const { error: updateError } = await supabase
      .from('receipts')
      .update({ status: 'Completed' })
      .eq('id', receiptId);

    if (updateError) {
      throw new Error(`Failed to update receipt: ${updateError.message}`);
    }

    // Check if stock record exists
    const { data: existingStock } = await supabase
      .from('stock')
      .select('*')
      .eq('product_id', receipt.product_id)
      .eq('warehouse_id', receipt.warehouse_id)
      .maybeSingle();

    if (existingStock) {
      // Update existing stock
      const { error: stockError } = await supabase
        .from('stock')
        .update({ quantity: existingStock.quantity + receipt.quantity })
        .eq('id', existingStock.id);

      if (stockError) {
        throw new Error(`Failed to update stock: ${stockError.message}`);
      }
    } else {
      // Create new stock record
      const { error: stockError } = await supabase
        .from('stock')
        .insert({
          product_id: receipt.product_id,
          warehouse_id: receipt.warehouse_id,
          quantity: receipt.quantity,
        });

      if (stockError) {
        throw new Error(`Failed to create stock: ${stockError.message}`);
      }
    }

    // Insert movement record
    const { error: movementError } = await supabase
      .from('movements')
      .insert({
        product_id: receipt.product_id,
        to_warehouse_id: receipt.warehouse_id,
        quantity: receipt.quantity,
        type: 'Receipt',
        reference_id: receiptId,
        date: receipt.date,
        created_by: user.id,
      });

    if (movementError) {
      throw new Error(`Failed to create movement: ${movementError.message}`);
    }

    console.log('Receipt completed successfully:', receiptId);

    return new Response(
      JSON.stringify({ success: true, message: 'Receipt completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error completing receipt:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
