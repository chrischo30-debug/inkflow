export interface BooksStatus {
  books_open: boolean;
  books_open_at?: string | null;
  books_close_at?: string | null;
}

export function isBooksOpen(status: BooksStatus): boolean {
  const now = new Date();
  if (status.books_open_at && new Date(status.books_open_at) > now) return false;
  if (status.books_close_at && new Date(status.books_close_at) < now) return false;
  return status.books_open ?? true;
}

export function booksStatusLabel(status: BooksStatus): string {
  const now = new Date();
  if (status.books_open_at && new Date(status.books_open_at) > now) {
    return `Opens ${new Date(status.books_open_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  if (status.books_close_at && new Date(status.books_close_at) > now && isBooksOpen(status)) {
    return `Closes ${new Date(status.books_close_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }
  return isBooksOpen(status) ? "Books Open" : "Books Closed";
}
