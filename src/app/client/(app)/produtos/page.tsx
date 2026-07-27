import { ProdutosView } from "@/features/client/components/produtos-view";
import { getProducts } from "@/features/client/data";

export default async function ProdutosPage() {
  const products = await getProducts();
  return <ProdutosView products={products} />;
}
