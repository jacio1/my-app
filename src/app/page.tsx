import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1>Главная страница</h1>
      <div className="bg-secondary w-100 h-100 m-10">
        <ul>
          <li>
            <Link href={'/tasks'}>Страница задач</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
