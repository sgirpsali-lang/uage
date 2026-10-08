# AUXY A13.25 — Catalog reset

This release ships exactly 500 movies and 500 series/dramas as seed metadata. It intentionally leaves all video URLs empty so you can add your own licensed playback source later from Studio. Artwork is resolved dynamically from public metadata providers; manual poster/banner URLs remain supported.

Run `/mnt/data/web.auxy.ir-A13.25-catalog.sql` in Supabase SQL Editor. **The SQL truncates existing movies/series and dependent season/episode rows. Back up first if needed.**

The Studio now has a global artwork source panel: Cinemeta/IMDb fallback, TVmaze for series, or Custom URL templates using `{title}`.
