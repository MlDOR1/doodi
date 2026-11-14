import "dotenv/config";
import movies from "./seed-data/movies.json";
import { prisma } from "../src/server/db";
import { hashPassword } from "../src/server/auth";

// DEVELOPMENT-ONLY credentials. Never use these in a real deployment.
export const DEMO_PASSWORD = "Doodi!2345";
const DEMO_USERS = [
  { email: "admin@doodi.test", displayName: "ผู้ดูแล DOODI", role: "admin" as const },
  { email: "member@doodi.test", displayName: "นักดูหนังตัวยง", role: "member" as const },
  { email: "mali@doodi.test", displayName: "มะลิ", role: "member" as const },
  { email: "nat@doodi.test", displayName: "ณัฐ", role: "member" as const },
];

// [user email, tmdb_id, rating, content, has_spoiler]
const REVIEWS: [string, number, number, string, boolean][] = [
  ["member@doodi.test", 1103621, 5, "ดูแล้วน้ำตาซึมตั้งแต่ครึ่งเรื่อง เล่าเรื่องครอบครัวได้จริงมาก อยากให้ทุกคนพาที่บ้านไปดูด้วยกัน", false],
  ["mali@doodi.test", 1103621, 5, "นักแสดงทุกคนเล่นดีมาก ฉากอาหารกับฉากครอบครัวนั่งคุยกันกินใจสุด ๆ", false],
  ["nat@doodi.test", 1103621, 4, "สนุกและซึ้ง จังหวะอาจช้านิดหน่อยช่วงกลางเรื่อง แต่ตอนจบคุ้มมาก", false],
  ["member@doodi.test", 496243, 5, "บทและงานภาพเยี่ยม ตลกก่อนแล้วค่อยหนักขึ้นเรื่อย ๆ ดูจบแล้วคิดต่อไปอีกหลายวัน", false],
  ["mali@doodi.test", 496243, 4, "ชอบการเล่าเรื่องชนชั้นผ่านบ้านสองหลัง ช่วงท้ายเรื่องช็อกมาก เพราะ **ตัวละครหลักตัดสินใจพลาดครั้งใหญ่** ที่ไม่มีใครคาดคิด", true],
  ["nat@doodi.test", 27205, 5, "หนังที่ดูกี่รอบก็ยังมีรายละเอียดใหม่ ภาพกับดนตรีเข้ากันสุด ๆ", false],
  ["member@doodi.test", 27205, 4, "ไอเดียสุดยอด แต่ต้องตั้งใจดูไม่งั้นหลุดง่าย เหมาะกับคนชอบคิดตาม", false],
  ["mali@doodi.test", 129, 5, "แอนิเมชันสวยละเมียด จินตนาการล้ำ ดูได้ทั้งครอบครัว", false],
  ["nat@doodi.test", 155, 5, "ตัวร้ายคือที่สุดของหนังซูเปอร์ฮีโร่ ดูกี่ครั้งก็ยังขนลุก", false],
  ["member@doodi.test", 155, 5, "จังหวะหนังแน่นตั้งแต่ต้นจนจบ บทสนทนาแต่ละฉากมีน้ำหนักมาก", false],
  ["mali@doodi.test", 17111, 4, "หลอนแบบค่อย ๆ บีบ ไม่ได้เน้นตกใจอย่างเดียว ตอนท้ายทำเอาขนลุก เพราะ **ความจริงเกี่ยวกับรูปถ่ายถูกเฉลย** อย่างเหนือความคาดหมาย", true],
  ["nat@doodi.test", 1113119, 4, "ตลกและสยองในเรื่องเดียวกัน แถมมีมุมอบอุ่นเรื่องวัฒนธรรมท้องถิ่นด้วย", false],
  ["member@doodi.test", 455714, 4, "ลุ้นทุกนาที ตัดต่อดีมาก ดูแล้วอยากปรบมือให้ทีมงาน", false],
  ["nat@doodi.test", 372058, 5, "ภาพสวยจนอยากหยุดเฟรม เพลงประกอบทำให้ซึ้งขึ้นอีกเท่าตัว", false],
  ["mali@doodi.test", 157336, 4, "ภาพอวกาศยิ่งใหญ่ ดนตรีกระแทกใจ ช่วงความสัมพันธ์พ่อกับลูกสาวเป็นหัวใจของเรื่อง", false],
  ["member@doodi.test", 244786, 5, "ซีนตีกลองช่วงท้ายทำเอาลืมหายใจ ดูแล้วเหนื่อยแทนตัวละครเลย", false],
  ["nat@doodi.test", 9316, 4, "ฉากต่อสู้สุดมันส์ ไม่พึ่งสแตนต์แมนเทียม ดูแล้วภูมิใจในหนังไทย", false],
  ["mali@doodi.test", 184219, 3, "ตลกดี แต่บางมุกเก่าไปหน่อย ภาพรวมยังน่ารักและดูเพลิน ๆ ได้", false],
];

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const users = new Map<string, number>();
  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { displayName: u.displayName, role: u.role, passwordHash },
    });
    users.set(u.email, row.id);
  }

  const movieIds = new Map<number, number>();
  for (const m of movies) {
    const data = {
      title: m.title,
      synopsis: m.synopsis,
      genre: m.genre,
      releaseYear: m.release_year,
      posterUrl: m.poster_url,
    };
    const row = await prisma.movie.upsert({
      where: { tmdbId: m.tmdb_id },
      create: { tmdbId: m.tmdb_id, ...data },
      update: data,
    });
    movieIds.set(m.tmdb_id, row.id);
  }

  for (const [email, tmdbId, rating, content, hasSpoiler] of REVIEWS) {
    const userId = users.get(email)!;
    const movieId = movieIds.get(tmdbId)!;
    await prisma.review.upsert({
      where: { userId_movieId: { userId, movieId } },
      create: { userId, movieId, rating, content, hasSpoiler },
      update: { rating, content, hasSpoiler },
    });
  }

  // A couple of saved movies so the member watchlist is not empty in the demo.
  const member = users.get("member@doodi.test")!;
  for (const tmdbId of [9316, 372058]) {
    await prisma.watchlist.upsert({
      where: { userId_movieId: { userId: member, movieId: movieIds.get(tmdbId)! } },
      create: { userId: member, movieId: movieIds.get(tmdbId)! },
      update: {},
    });
  }

  console.log(`Seeded ${users.size} users, ${movieIds.size} movies, ${REVIEWS.length} reviews.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
