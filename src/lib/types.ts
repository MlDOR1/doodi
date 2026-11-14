export type Role = "member" | "admin";

export interface UserDTO {
  user_id: number;
  display_name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface MovieDTO {
  movie_id: number;
  tmdb_id: number | null;
  title: string;
  synopsis: string | null;
  genre: string | null;
  release_year: number | null;
  poster_url: string | null;
  created_at: string;
  average_rating: number | null;
  review_count: number;
}

export interface ReviewDTO {
  reviews_id: number;
  movie_id: number;
  rating: number;
  content: string;
  has_spoiler: boolean;
  created_at: string;
  updated_at: string;
  author: { user_id: number; display_name: string };
}

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export const SORTS = ["newest", "top_rated", "most_reviewed"] as const;
export type Sort = (typeof SORTS)[number];
