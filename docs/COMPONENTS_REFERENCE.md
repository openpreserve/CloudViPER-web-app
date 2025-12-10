# Bootstrap 4 Components Reference

Quick reference for Bootstrap 4 components you can use in your documentation pages.

## Alerts

```html
<!-- Info Alert -->
<div class="alert alert-info" role="alert">
    <i class="fas fa-info-circle"></i> <strong>Note:</strong> Information message.
</div>

<!-- Warning Alert -->
<div class="alert alert-warning" role="alert">
    <i class="fas fa-exclamation-triangle"></i> <strong>Warning:</strong> Warning message.
</div>

<!-- Danger Alert -->
<div class="alert alert-danger" role="alert">
    <i class="fas fa-times-circle"></i> <strong>Error:</strong> Error message.
</div>

<!-- Success Alert -->
<div class="alert alert-success" role="alert">
    <i class="fas fa-check-circle"></i> <strong>Success:</strong> Success message.
</div>
```

## Cards

```html
<!-- Basic Card -->
<div class="card">
    <div class="card-body">
        <h5 class="card-title">Card Title</h5>
        <p class="card-text">Card content goes here.</p>
        <a href="#" class="btn btn-primary">Action</a>
    </div>
</div>

<!-- Card with Header -->
<div class="card">
    <div class="card-header">
        Featured
    </div>
    <div class="card-body">
        <h5 class="card-title">Special title treatment</h5>
        <p class="card-text">Card content.</p>
    </div>
</div>

<!-- Bordered Card -->
<div class="card border-primary">
    <div class="card-body">
        <h5 class="card-title">Primary Border</h5>
        <p class="card-text">Content with primary border.</p>
    </div>
</div>
```

## Buttons

```html
<!-- Primary Button -->
<a href="#" class="btn btn-primary">Primary</a>

<!-- Secondary Button -->
<a href="#" class="btn btn-secondary">Secondary</a>

<!-- Outline Button -->
<a href="#" class="btn btn-outline-primary">Outline</a>

<!-- Large Button -->
<a href="#" class="btn btn-primary btn-lg">Large Button</a>

<!-- Small Button -->
<a href="#" class="btn btn-primary btn-sm">Small Button</a>

<!-- Block Button -->
<a href="#" class="btn btn-primary btn-block">Block Button</a>
```

## Tables

```html
<table class="table">
    <thead>
        <tr>
            <th>Column 1</th>
            <th>Column 2</th>
            <th>Column 3</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Data 1</td>
            <td>Data 2</td>
            <td>Data 3</td>
        </tr>
    </tbody>
</table>

<!-- Striped Table -->
<table class="table table-striped">
    <!-- ... -->
</table>

<!-- Bordered Table -->
<table class="table table-bordered">
    <!-- ... -->
</table>

<!-- Hover Table -->
<table class="table table-hover">
    <!-- ... -->
</table>
```

## Code Blocks

```html
<!-- Inline Code -->
<code>inline code</code>

<!-- Code Block -->
<div class="card bg-dark text-white mb-4">
    <div class="card-body">
        <code>$ command line example</code><br>
        <code>output line 1</code><br>
        <code>output line 2</code>
    </div>
</div>

<!-- Pre Block -->
<pre><code>function example() {
    return "code block";
}</code></pre>
```

## Badges

```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-info">Info</span>
```

## List Groups

```html
<div class="list-group">
    <a href="#" class="list-group-item list-group-item-action active">
        Active item
    </a>
    <a href="#" class="list-group-item list-group-item-action">
        Second item
    </a>
    <a href="#" class="list-group-item list-group-item-action">
        Third item
    </a>
</div>
```

## Grid Layout

```html
<!-- Two Columns -->
<div class="row">
    <div class="col-md-6">
        Left column
    </div>
    <div class="col-md-6">
        Right column
    </div>
</div>

<!-- Three Columns -->
<div class="row">
    <div class="col-md-4">Column 1</div>
    <div class="col-md-4">Column 2</div>
    <div class="col-md-4">Column 3</div>
</div>

<!-- Responsive Columns -->
<div class="row">
    <div class="col-sm-12 col-md-6 col-lg-4">
        Responsive column
    </div>
</div>
```

## Font Awesome Icons

```html
<!-- Basic Icon -->
<i class="fas fa-home"></i>

<!-- Sized Icons -->
<i class="fas fa-home fa-2x"></i>
<i class="fas fa-home fa-3x"></i>
<i class="fas fa-home fa-4x"></i>

<!-- Colored Icons -->
<i class="fas fa-check text-success"></i>
<i class="fas fa-times text-danger"></i>
<i class="fas fa-info text-info"></i>

<!-- Common Icons -->
<i class="fas fa-book"></i>          <!-- Documentation -->
<i class="fas fa-rocket"></i>        <!-- Getting Started -->
<i class="fas fa-cog"></i>           <!-- Settings -->
<i class="fas fa-user"></i>          <!-- User -->
<i class="fas fa-shield-alt"></i>    <!-- Security -->
<i class="fas fa-database"></i>      <!-- Database -->
<i class="fas fa-docker"></i>        <!-- Docker -->
<i class="fab fa-github"></i>        <!-- GitHub -->
```

## Utility Classes

```html
<!-- Spacing -->
<div class="mt-3">Margin top 3</div>
<div class="mb-4">Margin bottom 4</div>
<div class="py-5">Padding top & bottom 5</div>

<!-- Text Alignment -->
<p class="text-left">Left aligned</p>
<p class="text-center">Center aligned</p>
<p class="text-right">Right aligned</p>

<!-- Text Colors -->
<p class="text-primary">Primary text</p>
<p class="text-success">Success text</p>
<p class="text-danger">Danger text</p>
<p class="text-muted">Muted text</p>

<!-- Background Colors -->
<div class="bg-primary text-white">Primary background</div>
<div class="bg-light">Light background</div>
<div class="bg-dark text-white">Dark background</div>

<!-- Display -->
<p class="display-1">Display 1</p>
<p class="display-4">Display 4</p>
<p class="lead">Lead paragraph</p>
```

## Responsive Utilities

```html
<!-- Hide on Mobile -->
<div class="d-none d-md-block">
    Hidden on mobile, visible on tablet+
</div>

<!-- Show only on Mobile -->
<div class="d-block d-md-none">
    Visible only on mobile
</div>
```

## Navigation

```html
<!-- Tabs -->
<ul class="nav nav-tabs">
    <li class="nav-item">
        <a class="nav-link active" href="#">Active</a>
    </li>
    <li class="nav-item">
        <a class="nav-link" href="#">Link</a>
    </li>
</ul>

<!-- Pills -->
<ul class="nav nav-pills">
    <li class="nav-item">
        <a class="nav-link active" href="#">Active</a>
    </li>
    <li class="nav-item">
        <a class="nav-link" href="#">Link</a>
    </li>
</ul>
```

For more components and detailed documentation, visit:
https://getbootstrap.com/docs/4.5/components/
