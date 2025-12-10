# Quick Start Guide for Documentation Site

## 🚀 5-Minute Setup

### Step 1: Test Locally (Optional but Recommended)

```bash
cd /var/docker-stacks/viper-cloud-web-gui/docs

# Install Ruby dependencies
bundle install

# Start Jekyll server
bundle exec jekyll serve

# Open http://localhost:4000 in your browser
```

### Step 2: Deploy to GitHub Pages

```bash
# Make sure you're on the right branch
git checkout gh-pages-docs

# Add all documentation files
git add docs/

# Commit with a descriptive message
git commit -m "Add GitHub Pages documentation site with Bootstrap 4"

# Push to GitHub
git push origin gh-pages-docs
```

### Step 3: Enable GitHub Pages

1. Go to: https://github.com/openpreserve/CloudViPER-web-app/settings/pages
2. Under **Source**:
   - Branch: `gh-pages-docs`
   - Folder: `/docs`
3. Click **Save**
4. Wait 1-2 minutes for deployment

### Step 4: View Your Site

Your site will be live at:
```
https://openpreserve.github.io/CloudViPER-web-app/
```

## 📝 Common Tasks

### Add a New Page

1. Create `docs/my-page.md`:
```markdown
---
layout: default
title: My Page
description: Description for SEO
---

<div class="container my-5">
    <h1>My Page Title</h1>
    <p>Content here...</p>
</div>
```

2. Add to navigation in `docs/_config.yml`:
```yaml
navigation:
  - title: My Page
    url: /my-page/
```

3. Commit and push:
```bash
git add docs/my-page.md docs/_config.yml
git commit -m "Add new page"
git push
```

### Update Existing Content

1. Edit the markdown file (e.g., `docs/index.md`)
2. Save changes
3. Commit and push:
```bash
git add docs/index.md
git commit -m "Update homepage content"
git push
```

### Add Images

1. Place images in `docs/img/`
2. Reference in markdown:
```markdown
![Alt text]({{ '/img/my-image.png' | relative_url }})
```

### Change Colors/Styling

Edit `docs/css/style.css` and modify the CSS variables:
```css
:root {
    --primary-color: #your-color;
}
```

## 🎨 Using Bootstrap Components

### Alert Box
```html
<div class="alert alert-info">
    <i class="fas fa-info-circle"></i> <strong>Note:</strong> Important info here.
</div>
```

### Feature Card
```html
<div class="card">
    <div class="card-body">
        <h5 class="card-title">Title</h5>
        <p class="card-text">Description</p>
    </div>
</div>
```

### Code Block
```html
<div class="card bg-dark text-white mb-4">
    <div class="card-body">
        <code>$ your command here</code>
    </div>
</div>
```

See `COMPONENTS_REFERENCE.md` for more!

## 🐛 Troubleshooting

### Site Not Building
- Check GitHub Actions: https://github.com/openpreserve/CloudViPER-web-app/actions
- Look for YAML syntax errors in markdown front matter
- Verify `_config.yml` is valid YAML

### Styles Not Loading
- Check browser console for 404 errors
- Verify paths use `| relative_url` filter
- Clear browser cache (Ctrl+Shift+R)

### Local Jekyll Errors
```bash
# Update gems
bundle update

# Clean and rebuild
bundle exec jekyll clean
bundle exec jekyll serve
```

## 📚 Documentation Files

- `BUILD_SUMMARY.md` - Complete overview of what was built
- `GITHUB_PAGES_SETUP.md` - Detailed deployment instructions
- `COMPONENTS_REFERENCE.md` - Bootstrap component examples
- `README.md` - Documentation repository guide
- `_page-template.md` - Template for creating new pages

## 🎯 What's Included

✅ Responsive Bootstrap 4 design
✅ Jekyll configuration for GitHub Pages
✅ Home page with hero section
✅ Getting Started guide
✅ Documentation page with sidebar navigation
✅ About page
✅ Custom CSS with modern styling
✅ JavaScript for smooth scrolling and interactions
✅ Header with navigation
✅ Footer with OPF branding
✅ Mobile-responsive layout
✅ Font Awesome icons
✅ Page templates and examples

## 🎉 You're Ready!

Your documentation site skeleton is complete and ready to customize with your actual content. Start by updating the placeholder text in:

1. `index.md` - Home page
2. `getting-started.md` - Installation guide
3. `documentation.md` - Technical docs
4. `about.md` - Project information

**Happy documenting! 📖**
