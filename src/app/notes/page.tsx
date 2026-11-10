import { Entries } from "@/components/entries";

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  return <Entries startNew={(await searchParams).new === "1"} section="notes" />;
}
