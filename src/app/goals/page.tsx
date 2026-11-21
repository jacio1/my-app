import { Entries } from "@/components/entries";

export default async function Page({ searchParams }: PageProps<"/goals">) {
  return <Entries startNew={(await searchParams).new === "1"} section="goals" />;
}
