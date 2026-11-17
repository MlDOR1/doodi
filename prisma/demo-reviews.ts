import { randomBytes } from "node:crypto";
import { prisma } from "../src/server/db";
import { hashPassword } from "../src/server/auth";

const examples = [
  { name: "Mali", rating: 5, content: "ภาพและดนตรีน่าสนใจ เป็นตัวอย่างรีวิวเชิงบวก", hasSpoiler: false },
  { name: "Nat", rating: 3, content: "จังหวะการเล่าเรื่องยังช้าในบางช่วง เป็นตัวอย่างรีวิวที่มีข้อเสนอแนะ", hasSpoiler: false },
  { name: "Beam", rating: 2, content: "ตัวอย่างข้อความสปอยล์สำหรับสาธิตการซ่อนเนื้อหา ไม่ใช่เหตุการณ์จริงในภาพยนตร์", hasSpoiler: true },
];

export async function seedDemoReviews() {
  const movies = await prisma.movie.findMany({
    where: { deletedAt: null, tmdbId: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true },
  });
  if (!movies.length) throw new Error("Import movies first: npm run db:import:current");
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  for (const example of examples) {
    const user = await prisma.user.upsert({
      where: { email: `${example.name.toLowerCase()}@reviews.example.test` },
      create: { email: `${example.name.toLowerCase()}@reviews.example.test`, displayName: `${example.name} (Demo)`, passwordHash },
      update: {},
    });
    for (const movie of movies) {
      await prisma.review.upsert({
        where: { userId_movieId: { userId: user.id, movieId: movie.id } },
        create: {
          userId: user.id, movieId: movie.id, rating: example.rating,
          content: `[DEMO / ข้อมูลจำลองเพื่อการศึกษา] ${example.content}`,
          hasSpoiler: example.hasSpoiler,
        },
        update: {},
      });
    }
  }
  return { movies: movies.length, demoReviewPairs: movies.length * examples.length };
}
