---
layout: default
title: Page Template
description: Template for creating new documentation pages
---

<!-- Hero Section (Optional - Remove if not needed) -->
<div class="hero-section bg-primary text-white py-5">
    <div class="container">
        <h1 class="display-4">Page Title</h1>
        <p class="lead">Brief description of this page's content.</p>
    </div>
</div>

<!-- Main Content -->
<div class="container my-5">
    <div class="row">
        <!-- Optional: Sidebar Navigation -->
        <div class="col-lg-3 d-none d-lg-block">
            <div class="docs-sidebar">
                <nav class="nav flex-column">
                    <a class="nav-link active" href="#section1">Section 1</a>
                    <a class="nav-link" href="#section2">Section 2</a>
                    <a class="nav-link" href="#section3">Section 3</a>
                </nav>
            </div>
        </div>
        
        <!-- Main Content Area -->
        <div class="col-lg-9">
            <h1 class="mb-4">Page Heading</h1>
            <p class="lead">Introduction paragraph with lead text styling.</p>
            
            <hr class="my-4">
            
            <h2 id="section1">Section 1</h2>
            <p>Regular paragraph text goes here. You can include:</p>
            <ul>
                <li>Unordered lists</li>
                <li>With multiple items</li>
                <li>For easy reading</li>
            </ul>
            
            <!-- Info Alert -->
            <div class="alert alert-info" role="alert">
                <i class="fas fa-info-circle"></i> <strong>Note:</strong> Use alerts to highlight important information.
            </div>
            
            <h3>Subsection</h3>
            <p>More content with ordered lists:</p>
            <ol>
                <li>First step</li>
                <li>Second step</li>
                <li>Third step</li>
            </ol>
            
            <!-- Code Block -->
            <div class="card bg-dark text-white mb-4">
                <div class="card-body">
                    <code>$ command --example</code><br>
                    <code>output from command</code>
                </div>
            </div>
            
            <h2 id="section2">Section 2</h2>
            
            <!-- Feature Cards -->
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title"><i class="fas fa-check-circle text-success"></i> Feature 1</h5>
                            <p class="card-text">Description of feature or concept.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card h-100">
                        <div class="card-body">
                            <h5 class="card-title"><i class="fas fa-check-circle text-success"></i> Feature 2</h5>
                            <p class="card-text">Description of feature or concept.</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Warning Alert -->
            <div class="alert alert-warning" role="alert">
                <i class="fas fa-exclamation-triangle"></i> <strong>Warning:</strong> Important warning message.
            </div>
            
            <h2 id="section3">Section 3</h2>
            
            <!-- Table -->
            <table class="table table-striped">
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
                    <tr>
                        <td>Data 4</td>
                        <td>Data 5</td>
                        <td>Data 6</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- Buttons -->
            <div class="mt-4">
                <a href="#" class="btn btn-primary">Primary Action</a>
                <a href="#" class="btn btn-outline-secondary">Secondary Action</a>
            </div>
        </div>
    </div>
</div>

<!-- Optional: Call to Action Section -->
<div class="bg-light py-5 mt-5">
    <div class="container">
        <div class="row">
            <div class="col-lg-8 mx-auto text-center">
                <h2 class="mb-4">Call to Action</h2>
                <p class="lead">Encourage users to take the next step.</p>
                <a href="{{ '/getting-started/' | relative_url }}" class="btn btn-primary btn-lg">Get Started</a>
            </div>
        </div>
    </div>
</div>
