const gulp = require('gulp');
const ts = require('gulp-typescript');
const clean = require('gulp-clean');
const tsProject = ts.createProject('tsconfig.json');
const imagemin = require('gulp-imagemin');



gulp.task('scripts', () => {
  return tsProject.src()
    .pipe(tsProject())
    .js.pipe(gulp.dest('dist'));
});

gulp.task('clean-views', () => {
    return gulp.src('dist/views', { read: false, allowEmpty: true })
      .pipe(clean());
});

gulp.task('views', () => {
  return gulp.src('src/views/**/*')
    .pipe(gulp.dest('dist/views'));
});

gulp.task('clean-public', () => {
    return gulp.src('dist/public', { read: false, allowEmpty: true })
      .pipe(clean());
});

gulp.task('public', () => {
    return gulp.src('src/public/**/*', {encoding: false})
        .pipe(gulp.dest('dist/public'));
});

gulp.task('default', gulp.series('scripts', 'clean-views', 'views', 'public'));
