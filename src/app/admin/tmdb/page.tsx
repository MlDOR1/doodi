import { TmdbImporter } from "@/components/TmdbImporter";
import { tmdbConfigured } from "@/server/tmdb";

export default function AdminTmdbPage() {
  return <TmdbImporter configured={tmdbConfigured()} />;
}
