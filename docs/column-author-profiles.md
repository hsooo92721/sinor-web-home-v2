# Column author profiles

Fields: id, name, image, affiliation (organization), position (job title), bio (plain text, max 3000 characters). Existing affiliation values are preserved without guessing how to split them.

Company API: GET /columns/authors, POST /admin/columns/authors and PUT /admin/columns/authors/:id must store/return position and bio. The article authorId links the current author record; authorProfile is a compatibility snapshot. Reader views resolve the current profile before rendering, so updates apply to existing articles without resaving each article. The author introduction is rendered separately from bodyHtml to avoid duplicating stored content.

/columns/ and /columns/about/ show the editor directory with profile dialogs. Article details automatically show the linked author introduction. Category buttons remain sticky at the top of the reader list while scrolling and reset pagination when changed.

Demo mode retains browser-local IndexedDB storage. Shared public persistence requires the company API, as before.

Photo adjustment stores imageOriginal (original source) and imageCrop ({x,y:0..1, zoom:1..3}) alongside image (the cropped square display image). Company author endpoints should retain these optional fields for later readjustment. All reader avatars continue using image so the applied crop looks consistent without view-specific positioning logic.
