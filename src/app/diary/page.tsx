import { Entries } from "@/components/entries";

export default async function DiaryPage({ searchParams }: PageProps<"/diary">) {
  return <Entries startNew={(await searchParams).new === "1"} section="diary" />;
}
