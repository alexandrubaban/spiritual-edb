/**
 * The task ""grunt-spiritual" may be installed 
 * via `npm install wunderbyte/grunt-spiritual`.
 */
module.exports = function ( grunt ) {

	"use strict";
	
	grunt.loadNpmTasks ( "grunt-spiritual-build" );
	grunt.initConfig ({
		spiritual : {
			gui : {
				options : {
					banner : (
						'/**\n' +
						' * Spiritual EDB\n' +
						' * (c) 2013 Wunderbyte\n' +
						' * Spiritual is freely distributable under the MIT license.\n' +
						' */\n'
					 )
				},
				files : {
					"dist/spiritual-edb.js" : [ "src/edb.module/build.json" ]
				}
			}
		}
	});
	grunt.registerTask ( "default", "spiritual" );
};