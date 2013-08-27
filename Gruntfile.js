/*global module:false*/

// (npm uninstall -g grunt)
// npm install -g grunt-cli
// npm install -g grunt --save-dev
// npm install grunt-contrib-concat --save-dev
// npm install grunt-contrib-uglify --save-dev 
// npm install grunt-contrib-jshint --save-dev

module.exports = function ( grunt ) {

	grunt.loadNpmTasks ( "grunt-contrib-concat" );
	grunt.loadNpmTasks ( "grunt-contrib-uglify" );
	grunt.loadNpmTasks ( "grunt-contrib-jshint" );
	grunt.loadNpmTasks ( "grunt-spiritual-dox"  );

	var sourcelist = grunt.file.readJSON("Gruntfile.json");
	sourcelist.unshift("<banner:meta.banner>");

	var BANNER = '' +
		'/*\n' +
		' * Spiritual EDB <%= meta.version %>\n' +
		' * (c) <%= grunt.template.today("yyyy") %> Wunderbyte\n' +
		' * Spiritual is freely distributable under the MIT license.\n' +
		' */\n\n' +
		' ( function () {\n' +
		' "use strict";\n';
	var FOOTER = '}());';
	var SPACER = "\n\n\n";

	grunt.initConfig({
		meta: {
			version: "0.0.2"
		},
		jshint: {
			all: [ "Gruntfile.js", "src/**/*.js" ],
			options: {
				curly: true,
				eqeqeq: true,
				immed: true,
				latedef: true, 
				newcap: true,
				noarg: true,
				sub: true,
				undef: true,
				boss: true,
				eqnull: true,
				browser: true,
				smarttabs:true,
				onecase: true,
				scripturl: true,
				laxbreak: true,
				supernew: true,
				regexdash: true,
				globals: {
					gui: true,
					edb: true,
					console: true,
					self : true,
					alert: true,
					setImmediate : true,
					requestAnimationFrame : true,
					Map : true,
					Set : true,
					WeakMap : true
				}
			}
		},
		concat: {
			options: {
				separator : SPACER,
				banner: BANNER + SPACER,
				footer : SPACER + FOOTER
			},
			dist: {
				src: sourcelist,
				dest: 'dist/spiritual-edb-<%= meta.version %>.js',
				separator : "\n\n\n"
			}
		},
		uglify: {
	    options: {
	      mangle: false,
	      banner: BANNER
	    },
	    my_target: {
	      files: {
	        'dist/spiritual-edb-<%= meta.version %>.min.js': ['dist/spiritual-edb-<%= meta.version %>.js']
	      }
	    }
	  },
		dox : {
			files: {
				"dox/sources.json" : [ "src/**/*.js" ]
			}
		},
		doxbuild : {
			options : {
				mangle : true
			},
			files: {
				"dox" : "../spiritual-dox"
			}
		}
	});

	// default task
	grunt.registerTask('default', [ "jshint", "concat", "uglify", "dox", "doxbuild" ]);
};
