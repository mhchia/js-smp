const browserify = require('browserify');
const tsify = require('tsify');

browserify({debug: true, paths: ['./node_modules', './node_modules/peerjs/dist']})
    .add('./src/main.js')
    // .plugin(tsify)
    .bundle()
    .on('error', function (error) { console.error(error.toString()); })
    .pipe(process.stdout);
