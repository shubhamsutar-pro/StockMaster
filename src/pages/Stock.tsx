import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

const Stock = () => {
  const [stock, setStock] = useState<any[]>([]);
  const [filteredStock, setFilteredStock] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchStock();
  }, []);

  useEffect(() => {
    const filtered = stock.filter(
      (item) =>
        item.products.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.products.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.warehouses.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredStock(filtered);
  }, [searchQuery, stock]);

  const fetchStock = async () => {
    const { data } = await supabase
      .from("stock")
      .select("*, products(name, sku, reorder_level), warehouses(name)")
      .order("quantity", { ascending: true });
    setStock(data || []);
    setFilteredStock(data || []);
  };

  const getStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (quantity < reorderLevel) return { label: "Low Stock", variant: "default" as const };
    return { label: "Normal", variant: "default" as const };
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock</h1>
        <p className="text-muted-foreground">Current stock levels per warehouse</p>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-sm" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStock.map((item) => {
              const status = getStatus(item.quantity, item.products.reorder_level);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.products.name}</TableCell>
                  <TableCell>{item.products.sku}</TableCell>
                  <TableCell>{item.warehouses.name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className={status.label === "Low Stock" ? "bg-warning text-warning-foreground" : ""}>
                      {status.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Stock;
