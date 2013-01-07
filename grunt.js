/*global module:false*/

module.exports = function(grunt) {
	grunt.initConfig({
		meta: {
			version: '0.0.1',
			banner : '' +
				'/*\n' +
				' * Spiritual EDB <%= meta.version %>\n' +
				' * (c) <%= grunt.template.today("yyyy") %> Wunderbyte\n' +
				' * Spiritual is freely distributable under the MIT license.\n' +
				' */'
		},
		lint: {
			files: ['grunt.js', 'src/**/*.js']
		},
		concat: {
			dist: {
				src: [
					"<banner:meta.banner>",
					"src/edb.module/edb.js",
					"src/edb.module/models/edb.Model.js",
					"src/edb.module/models/edb.ObjectModel.js",
					"src/edb.module/models/edb.ArrayModel.js",
					"src/edb.module/models/edb.MapModel.js",
					"src/edb.module/utils/edb.Service.js",
					"src/edb.module/plugins/view/edb.SpiritView.js",
					"src/edb.module/plugins/input/edb.Input.js",
					"src/edb.module/plugins/output/edb.Output.js",
					"src/edb.module/plugins/input/edb.InputTracker.js",
					"src/edb.module/spirits/edb.ScriptSpirit.js",
					"src/edb.module/spirits/edb.ServiceSpirit.js",
					"src/edb.module/updates/edb.UpdateAssistant.js",
					"src/edb.module/updates/edb.UpdateManager.js",
					"src/edb.module/updates/edb.UpdateCollector.js",
					"src/edb.module/updates/types/edb.Update.js",
					"src/edb.module/updates/types/atts/edb.AttsUpdate.js",
					"src/edb.module/updates/types/hard/edb.HardUpdate.js",
					"src/edb.module/updates/types/soft/edb.SoftUpdate.js",
					"src/edb.module/updates/types/soft/edb.InsertUpdate.js",
					"src/edb.module/updates/types/soft/edb.AppendUpdate.js",
					"src/edb.module/updates/types/soft/edb.RemoveUpdate.js",
					"src/edb.module/updates/types/script/edb.ScriptUpdate.js",
					"src/edb.module/scripts/generic/edb.GenericScript.js",
					"src/edb.module/scripts/generic/edb.GenericLoader.js",
					"src/edb.module/scripts/edb.Script.js",
					"src/edb.module/scripts/edb.Loader.js",
					"src/edb.module/scripts/edb.Out.js",
					"src/edb.module/scripts/edb.Function.js",
					"src/edb.module/scripts/compiler/edb.Instruction.js",
					"src/edb.module/scripts/compiler/edb.FunctionCompiler.js",
					"src/edb.module/scripts/compiler/edb.ScriptCompiler.js",
					"src/edb.module/edb.module.js"
				],
				dest: 'dist/spiritual-edb-<%= meta.version %>.js',
				separator : "\n\n\n"
			}
		},
		min: {
			dist: {
				src: ['<banner:meta.banner>','<config:concat.dist.dest>'],
				dest: 'dist/spiritual-edb-<%= meta.version %>.min.js'
			}
		},
		watch: {
			files: '<config:.files>',
			tasks: 'lint'
		},
		jshint: {
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
				smarttabs:true, // https://github.com/jshint/jshint/issues/585
				onecase: true,
				scripturl: true,
				laxbreak: true,
				supernew: true
			},
			globals: {
				gui: true,
				edb : true,
				console: true,
				setImmediate : true,
				requestAnimationFrame : true,
				Map : true,
				Set : true,
				WeakMap : true
			}
		},
		uglify: {}
	});

	// default task
	grunt.registerTask('default', 'lint concat min');
};