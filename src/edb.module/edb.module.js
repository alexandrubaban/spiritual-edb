/*
 * Register module.
 */
gui.module ( "edb", {
	
	/*
	 * Extending all spirits.
	 */
	addins : { // TODO: rename "extensions" or something
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {} // TODO: rename "onedbinput"
	},
	
	/*
	 * Register default plugins for all spirits.
	 */
	plugins : {
		script : edb.ScriptPlugin,
		input : edb.InputPlugin,
		output : edb.OutputPlugin
	},
	
	/*
	 * Channeling spirits to CSS selectors.
	 */
	channels : [
		[ "script[type='text/edbml']", "edb.ScriptSpirit" ],
		[ "link[rel='service']", "edb.ServiceSpirit" ]
	],

	/**
	 * Init module.
	 * @param {Window} context
	 */
	init : function ( context ) {

		// TODO: detect sandbox...
		if ( context === gui.context ) { // TODO: better detect top context
			if ( edb.GenericScript && edb.GenericLoader ) { // TODO: this check is for sandbox (future project)
				edb.GenericScript.set ( edb.Script, "text/edbml" );
				edb.GenericLoader.set ( edb.Loader, "text/edbml" );
			}
		}
		context.Object.model = function ( a1, a2 ) {
			return edb.ObjectModel.extend ( a1, a2 );
		};
		context.Array.model = function ( a1, a2 ) {
			return edb.ArrayModel.extend ( a1, a2 );
		};
		context.Map.model = function ( a1, a2 ) {
			return edb.MapModel.extend ( a1, a2 );
		};
	}
});