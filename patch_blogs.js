import fs from 'fs';

let code = fs.readFileSync('data/Routes/blogs.js', 'utf8');

// Patch GET /categories
code = code.replace(
    /if \(error \|\| !data \|\| data\.length === 0\) \{/g,
    `if (error || !data) { console.warn('[Blog] Categories fetch error, fallback demo'); return res.json({ success: true, categories: demoBlogCategories }); } if (data.length === 0) {`
);
// Fix the closing bracket for if (data.length === 0)
// Actually wait, let's just do a simpler replace.
