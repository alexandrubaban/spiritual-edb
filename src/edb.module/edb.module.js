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
		oninput : function ( input ) {}
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
	 * @TODO this may be a bit silly...
	 * @TODO detect sandbox...
	 * @param {Window} context
	 */
	oncontextinitialize : function ( context ) {
		if ( context === gui.context ) { // TODO: better detect top context
			if ( edb.Template && edb.TemplateLoader ) { // hack to bypass the sandbox (future project)
				edb.Template.setImplementation ( 
					edb.Script, 
					"application/x-edbml",
					"application/edbml",
					"text/edbml",
					"edbml"
				);
			}
		}
	}
});