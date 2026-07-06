const browsersync = require("browser-sync").create();
const cached = require("gulp-cached");
const cleanCSS = require("clean-css");
const cssnano = require("gulp-cssnano");
const del = require("del");
const fileinclude = require("gulp-file-include");
const gulp = require("gulp");
const gulpif = require("gulp-if");
const npmdist = require("gulp-npm-dist");
const replace = require("gulp-replace");
const uglify = require("gulp-uglify");
const useref = require("gulp-useref-plus");
const rename = require("gulp-rename");
const sass = require("gulp-sass")(require("sass"));
const sourcemaps = require("gulp-sourcemaps");
const postcss = require("gulp-postcss");
const autoprefixer = require("autoprefixer");
const tailwindcss = require("tailwindcss");
const { isWsl, getLocalIPv4, isPortAvailable, announceDevUrls } = require("./scripts/wsl-dev");

const paths = {
  config: {
    tailwind: "./tailwind.config.js",
  },
  base: {
    base: {
      dir: "./",
    },
    node: {
      dir: "./node_modules",
    },
    packageLock: {
      files: "./package-lock.json",
    },
  },
  dist: {
    base: {
      dir: "./dist",
      files: "./dist/**/*",
    },
    libs: {
      dir: "./dist/assets/libs",
    },
    css: {
      dir: "./dist/assets/css",
    },
    js: {
      dir: "./dist/assets/js",
      files: "./dist/assets/js",
    },
    php: {
      dir: "./dist/assets/php",
      files: "./dist/assets/php",
    },
    img: {
      dir: "./dist/assets/images",
      files: "./dist/assets/images/**/*",
    },
    fonts: {
      dir: "./dist/assets/fonts",
      files: "./dist/assets/fonts",
    },
  },
  src: {
    base: {
      dir: "./src",
      files: "./src/**/*",
    },
    fonts: {
      dir: "./src/assets/fonts",
      files: "./src/assets/fonts",
    },
    img: {
      dir: "./src/assets/images",
      files: "./src/assets/images/**/*",
    },
    js: {
      dir: "./src/assets/js",
      files: "./src/assets/js/*.js",
    },
    php: {
      dir: "./src/assets/php",
      files: "./src/assets/php/*.php",
    },
    scss: {
      dir: "./src/assets/scss",
      files: "./src/assets/scss/**/*.scss",
      all: "./src/assets/scss/**/*",
    },
    html: {
      dir: "./src",
      files: "./src/**/*.html",
    },
    partials: {
      dir: "./src/partials",
      files: "./src/partials/**/*",
    },
  },
};

gulp.task("browsersync", function (callback) {
  const devPort = 3000;
  const devUiPort = 3001;

  isPortAvailable(devPort).then(function (available) {
    if (!available) {
      console.error(
        `\n  Port ${devPort} is already in use. Stop the other dev server first (Ctrl+C), then run npm run dev again.\n`
      );
      callback(new Error(`Port ${devPort} is already in use`));
      return;
    }

    const wslIp = getLocalIPv4();
    const bsConfig = {
      server: {
        baseDir: [paths.dist.base.dir, paths.src.base.dir, paths.base.base.dir],
      },
      host: "0.0.0.0",
      port: devPort,
      open: false,
      notify: false,
      online: true,
      ui: {
        host: "0.0.0.0",
        port: devUiPort,
      },
    };

    if (isWsl() && wslIp) {
      bsConfig.socket = {
        domain: `${wslIp}:${devPort}`,
      };
    }

    browsersync.init(bsConfig, function (err, bs) {
      if (err) {
        callback(err);
        return;
      }

      announceDevUrls(bs.options.get("port"));
      callback();
    });
  });
});

gulp.task("browsersyncReload", function (callback) {
  browsersync.reload();
  callback();
});

gulp.task("watch", function () {
  gulp.watch([paths.src.img.files], gulp.series("images", "browsersyncReload"));
  gulp.watch([paths.src.js.files], gulp.series("js", "browsersyncReload"));
  gulp.watch([paths.src.php.files], gulp.series("php", "browsersyncReload"));
  gulp.watch([paths.src.scss.files], gulp.series("scss", "browsersyncReload"));
  gulp.watch(
    [paths.src.html.files, paths.src.partials.files],
    gulp.series(["fileinclude", "scss"], "browsersyncReload")
  );
});

gulp.task("fonts", function () {
  return gulp
    .src(paths.src.fonts.files, { encoding: true })
    .pipe(gulp.dest(paths.dist.fonts.dir));
});

gulp.task("js", function () {
  return (
    gulp
      .src(paths.src.js.files)
      // .pipe(uglify())
      .pipe(gulp.dest(paths.dist.js.dir))
  );
});

gulp.task("php", function () {
  return gulp.src(paths.src.php.files).pipe(gulp.dest(paths.dist.php.dir));
});

gulp.task("images", function () {
  return gulp
    .src(paths.src.img.files, { encoding: false })
    .pipe(gulp.dest(paths.dist.img.dir));
});

const cssOptions = {
  compatibility: "*", // (default) - Internet Explorer 10+ compatibility mode
  inline: ["all"], // enables all inlining, same as ['local', 'remote']
  level: 2, // Optimization levels. The level option can be either 0, 1 (default), or 2, e.g.
};

gulp.task("scss", function () {
  // generate tailwind
  return (
    gulp
      .src(paths.src.scss.files)
      .pipe(sourcemaps.init())
      .pipe(sass().on("error", sass.logError))

      .pipe(postcss([tailwindcss(paths.config.tailwind), autoprefixer()]))
      .pipe(gulp.dest(paths.dist.css.dir))
      // .pipe(cssnano({ svgo: false }))
      .on("data", function (file) {
        console.log("------------", file.basename, file.path);
        const buferFile = new cleanCSS(cssOptions).minify(file.contents);
        return (file.contents = Buffer.from(buferFile.styles));
      })
      .pipe(
        rename({
          suffix: ".min",
        })
      )
      .pipe(sourcemaps.write("./"))
      .pipe(gulp.dest(paths.dist.css.dir))
  );
});

gulp.task("fileinclude", function () {
  return gulp
    .src([
      paths.src.html.files,
      "!" + paths.dist.base.files,
      "!" + paths.src.partials.files,
    ])
    .pipe(
      fileinclude({
        prefix: "@@",
        basepath: "@file",
        indent: true,
      })
    )
    .pipe(cached())
    .pipe(gulp.dest(paths.dist.base.dir));
});

gulp.task("clean:packageLock", function (callback) {
  del.sync(paths.base.packageLock.files);
  callback();
});

gulp.task("clean:dist", function (callback) {
  del.sync(paths.dist.base.dir);
  callback();
});

gulp.task("copy:all", function () {
  return gulp
    .src([
      paths.src.base.files,
      "!" + paths.src.partials.dir,
      "!" + paths.src.partials.files,
      "!" + paths.src.scss.dir,
      "!" + paths.src.scss.all,
      "!" + paths.src.js.dir,
      "!" + paths.src.js.files,
      "!" + paths.src.php.dir,
      "!" + paths.src.php.files,
      "!" + paths.src.html.dir,
      "!" + paths.src.html.files,
      "!" + paths.src.img.dir,
      "!" + paths.src.img.files,
      "!" + paths.src.fonts.dir,
      "!" + paths.src.fonts.files,
    ])
    .pipe(gulp.dest(paths.dist.base.dir));
});

gulp.task("copy:libs", function () {
  return gulp
    .src(npmdist(), { base: paths.base.node.dir })
    .pipe(
      rename(function (path) {
        path.dirname = path.dirname.replace(/\/dist/, "").replace(/\\dist/, "");
      })
    )
    .pipe(gulp.dest(paths.dist.libs.dir));
});

gulp.task("html", function () {
  return gulp
    .src([
      paths.src.html.files,
      "!" + paths.dist.base.files,
      "!" + paths.src.partials.files,
    ])
    .pipe(
      fileinclude({
        prefix: "@@",
        basepath: "@file",
        indent: true,
      })
    )
    .pipe(replace(/href="(.{0,10})node_modules/g, 'href="$1assets/libs'))
    .pipe(replace(/src="(.{0,10})node_modules/g, 'src="$1assets/libs'))
    .pipe(useref())
    .pipe(cached())
    .pipe(gulpif("*.js", uglify()))
    .pipe(gulpif("*.php", uglify()))
    .pipe(gulpif("*.css", cssnano({ svgo: false })))
    .pipe(gulp.dest(paths.dist.base.dir));
});

// Default(Producation) Task
gulp.task(
  "default",
  gulp.series(
    gulp.parallel(
      "clean:packageLock",
      "clean:dist",
      "copy:all",
      "copy:libs",
      "fileinclude",
      "fonts",
      "scss",
      "js",
      "php",
      "html",
      "images"
    ),
    gulp.parallel("browsersync", "watch")
  )
);

// Build(Development) Task
gulp.task(
  "build",
  gulp.series(
    "clean:packageLock",
    "clean:dist",
    "copy:all",
    "copy:libs",
    "fileinclude",
    "fonts",
    "scss",
    "js",
    "html",
    "images"
  )
);
