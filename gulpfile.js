var gulp = require('gulp');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
const babelify = require('babelify');

gulp.task('default', function () {
    return browserify({
        basedir: '.',
        debug: true,
        // paths: [
        //     './node_modules',
        //     './node_modules/peerjs/dist',
        //     './node_modules/peerjs/lib',
        //     './node_modules/peerjs-js-binarypack/dist',
        //     './node_modules/peerjs-js-binarypack/lib',
        // ],
        entries: ['src/main.ts'],
        cache: {},
        packageCache: {},
    })
    .plugin(tsify)
    .transform(babelify, { extensions: [ '.tsx', '.ts' ]})
    .bundle()
    .pipe(source('examples/bundle.js'))
    .pipe(gulp.dest('dist'));
});
    // return browserify({
    //     basedir: '.',
    //     debug: true,
    //     entries: ['src/main.ts'],
    //     cache: {},
    //     packageCache: {}
    // })
    // .plugin(tsify, { target: 'es6', noImplicitAny: true })
    // .transform(babelify, { extensions: [ '.tsx', '.ts' ], presets: ["es2015"] })
    // .bundle()
    // .pipe(source('bundle.js'))
    // .pipe(gulp.dest('dist'));

