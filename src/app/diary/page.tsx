import { Card, CardContent } from "@/components/ui/card";

const diaryNote = [
  {
    id: 1,
    dayDescription: "Day 1 description",
    createdAt: new Date(),
  },
];

export default function DiaryPage() {
  return (
    <div>
      <h1>Страница дневника</h1>
      <Card>
        <CardContent>
          {diaryNote[0].dayDescription}
        </CardContent>
      </Card>
    </div>
  );
}
