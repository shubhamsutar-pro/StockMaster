import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, TrendingDown, AlertTriangle, FileText, TruckIcon } from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingReceipts: number;
  pendingDeliveries: number;
}

interface LowStockItem {
  product_name: string;
  sku: string;
  min_quantity: number;
  reorder_level: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get total products
      const { count: productsCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      // Get total stock quantity
      const { data: stockData } = await supabase.from("stock").select("quantity");
      const totalStock = stockData?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      // Get low stock and out of stock counts
      const { data: stockWithProducts } = await supabase
        .from("stock")
        .select("quantity, products(reorder_level)");

      let lowStockCount = 0;
      let outOfStockCount = 0;

      stockWithProducts?.forEach((item) => {
        if (item.quantity === 0) outOfStockCount++;
        else if (item.quantity < (item.products as any)?.reorder_level) lowStockCount++;
      });

      // Get pending receipts
      const { count: pendingReceiptsCount } = await supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending");

      // Get pending deliveries
      const { count: pendingDeliveriesCount } = await supabase
        .from("delivery_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "Pending");

      // Get top 5 low stock items
      const { data: lowStock } = await supabase
        .from("stock")
        .select(
          `
          quantity,
          products(name, sku, reorder_level)
        `
        )
        .order("quantity", { ascending: true })
        .limit(5);

      const formattedLowStock: LowStockItem[] =
        lowStock?.map((item: any) => ({
          product_name: item.products.name,
          sku: item.products.sku,
          min_quantity: item.quantity,
          reorder_level: item.products.reorder_level,
        })) || [];

      setStats({
        totalProducts: productsCount || 0,
        totalStock,
        lowStockCount,
        outOfStockCount,
        pendingReceipts: pendingReceiptsCount || 0,
        pendingDeliveries: pendingDeliveriesCount || 0,
      });

      setLowStockItems(formattedLowStock);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Products",
      value: stats.totalProducts,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Total Stock",
      value: stats.totalStock,
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Low Stock Items",
      value: stats.lowStockCount,
      icon: TrendingDown,
      color: "text-warning",
    },
    {
      title: "Out of Stock",
      value: stats.outOfStockCount,
      icon: AlertTriangle,
      color: "text-destructive",
    },
    {
      title: "Pending Receipts",
      value: stats.pendingReceipts,
      icon: FileText,
      color: "text-muted-foreground",
    },
    {
      title: "Pending Deliveries",
      value: stats.pendingDeliveries,
      icon: TruckIcon,
      color: "text-muted-foreground",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your inventory management system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Top 5 Low Stock Items</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No low stock items found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Min Quantity</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="text-right">{item.min_quantity}</TableCell>
                    <TableCell className="text-right">{item.reorder_level}</TableCell>
                    <TableCell>
                      <Badge
                        variant={item.min_quantity === 0 ? "destructive" : "default"}
                        className={
                          item.min_quantity === 0
                            ? ""
                            : "bg-warning text-warning-foreground"
                        }
                      >
                        {item.min_quantity === 0 ? "Out of Stock" : "Low Stock"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
