import { z } from "zod";
import { SORTS } from "@/lib/types";

const req = (label: string) => ({ error: `กรุณากรอก${label}` });
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const normalizeGenre = (s: string) =>
  s
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .join(",");

export const registerSchema = z
  .object({
    display_name: z
      .string(req("ชื่อที่แสดง"))
      .trim()
      .min(2, "ชื่อที่แสดงต้องมีอย่างน้อย 2 ตัวอักษร")
      .max(100, "ชื่อที่แสดงยาวเกิน 100 ตัวอักษร"),
    email: z
      .string(req("อีเมล"))
      .trim()
      .toLowerCase()
      .max(255, "อีเมลยาวเกินไป")
      .pipe(z.email("รูปแบบอีเมลไม่ถูกต้อง")),
    password: z
      .string(req("รหัสผ่าน"))
      .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(128, "รหัสผ่านยาวเกิน 128 ตัวอักษร"),
    password_confirmation: z.string(req("ยืนยันรหัสผ่าน")),
  })
  .refine((d) => d.password === d.password_confirmation, {
    path: ["password_confirmation"],
    message: "รหัสผ่านและการยืนยันไม่ตรงกัน",
  });

export const loginSchema = z.object({
  email: z.string(req("อีเมล")).trim().toLowerCase().min(1, "กรุณากรอกอีเมล").max(255),
  password: z.string(req("รหัสผ่าน")).min(1, "กรุณากรอกรหัสผ่าน").max(128),
});

const pageField = z.coerce.number().int().min(1, "หน้าต้องเริ่มที่ 1").max(100000).default(1);
const pageSizeField = (def: number) => z.coerce.number().int().min(1).max(50, "page_size สูงสุด 50").default(def);

export const movieListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  genre: z
    .string()
    .trim()
    .max(50)
    .refine((g) => !g.includes(","), "genre ต้องเป็นหมวดเดียว")
    .optional(),
  year: z.coerce.number().int().min(1800).max(2200).optional(),
  sort: z.enum(SORTS).default("newest"),
  page: pageField,
  page_size: pageSizeField(12),
});

export const pageQuery = (def = 10) => z.object({ page: pageField, page_size: pageSizeField(def) });

export const tmdbSearchQuery = z.object({
  query: z.string({ error: "กรุณากรอกคำค้นหา" }).trim().min(1, "กรุณากรอกคำค้นหา").max(100),
  page: pageField,
});

const maxYear = new Date().getFullYear() + 5;
const synopsis = z.preprocess(emptyToNull, z.string().trim().max(10000, "เรื่องย่อยาวเกินไป").nullable());
const genre = z.preprocess(
  emptyToNull,
  z
    .string()
    .max(200)
    .transform(normalizeGenre)
    .refine((g) => g.length <= 100, "หมวดหมู่รวมกันยาวเกิน 100 ตัวอักษร")
    .transform((g) => g || null)
    .nullable(),
);
const releaseYear = z.preprocess(
  emptyToNull,
  z
    .number({ error: "ปีที่ออกฉายต้องเป็นตัวเลข" })
    .int()
    .min(1888, "ปีที่ออกฉายไม่ถูกต้อง")
    .max(maxYear, "ปีที่ออกฉายไม่ถูกต้อง")
    .nullable(),
);
const posterUrl = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2048, "ลิงก์โปสเตอร์ยาวเกินไป")
    .refine((u) => /^https?:\/\//i.test(u) && URL.canParse(u), "ลิงก์โปสเตอร์ต้องขึ้นต้นด้วย http:// หรือ https://")
    .nullable(),
);
const title = z.string(req("ชื่อหนัง")).trim().min(1, "กรุณากรอกชื่อหนัง").max(255, "ชื่อหนังยาวเกิน 255 ตัวอักษร");

export const createMovieSchema = z.object({
  title,
  synopsis: synopsis.optional(),
  genre: genre.optional(),
  release_year: releaseYear.optional(),
  poster_url: posterUrl.optional(),
});

export const updateMovieSchema = createMovieSchema
  .partial()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "ไม่มีข้อมูลที่จะแก้ไข" });

const rating = z
  .number({ error: "คะแนนต้องเป็นตัวเลข 1 ถึง 5" })
  .int("คะแนนต้องเป็นจำนวนเต็ม 1 ถึง 5")
  .min(1, "คะแนนต้องอยู่ระหว่าง 1 ถึง 5")
  .max(5, "คะแนนต้องอยู่ระหว่าง 1 ถึง 5");
const content = z
  .string(req("เนื้อหารีวิว"))
  .trim()
  .min(5, "รีวิวต้องมีอย่างน้อย 5 ตัวอักษร")
  .max(5000, "รีวิวยาวเกิน 5,000 ตัวอักษร");

export const createReviewSchema = z.object({
  rating,
  content,
  has_spoiler: z.boolean({ error: "has_spoiler ต้องเป็น true/false" }).default(false),
});

export const updateReviewSchema = z
  .object({
    rating: rating.optional(),
    content: content.optional(),
    has_spoiler: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "ไม่มีข้อมูลที่จะแก้ไข" });

export const watchlistAddSchema = z.object({
  movie_id: z.number({ error: "movie_id ต้องเป็นตัวเลข" }).int().positive("movie_id ไม่ถูกต้อง").max(2147483647),
});

export const tmdbImportSchema = z.object({
  tmdb_id: z.number({ error: "tmdb_id ต้องเป็นตัวเลข" }).int().positive("tmdb_id ไม่ถูกต้อง").max(2147483647),
});
