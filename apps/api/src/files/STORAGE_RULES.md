# Storage rules

- Backend validates file type, MIME type, document-specific size limit and permissions.
- Supabase service role key stays in the API only.
- RNE, patente, organigramme and ordres de mission are private.
- Logos may be stored in a public bucket or served using signed URLs.
- Save every upload in the File table.
- Remove both the Storage object and its File metadata when an authorized user removes a client document.
