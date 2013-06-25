/*
 * Register module.
 */
gui.module ( "edb", {
	
	/*
	 * Extending all spirits.
	 */
	mixins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {},

		/**
		 * Handle changes.
		 * @param {Array<edb.Change>}
		 */
		onchange : function ( changes ) {}
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
	]

});