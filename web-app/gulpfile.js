const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
// const del = require('del');
const copy = require('gulp-copy');

const tsProject = ts.createProject('tsconfig.json');

// Clean the dist directory
// gulp.task('clean', () => {
//     return del(['dist']);
// });

// Compile TypeScript files
gulp.task('scripts', () => {
    return tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'));
});

// Copy static files
gulp.task('copy-views', () => {
    return gulp.src('src/views/**/*')
        .pipe(copy('dist/views', { prefix: 2 }));
});

gulp.task('copy-public', () => {
    return gulp.src('src/public/**/*')
        .pipe(copy('dist/public', { prefix: 2 }));
});

// Define the build task
// gulp.task('build', gulp.series('clean', 'scripts', 'copy-views', 'copy-public'));
gulp.task('build', gulp.series( 'scripts', 'copy-views', 'copy-public'));

// Default task
gulp.task('default', gulp.series('build'));