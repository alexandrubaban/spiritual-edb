/*
 * Register module.
 */
gui.module ( "edb", {
	
	/*
	 * Helo
	 */
	addins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {}
	},
	
	/*
	 * Helo
	 */
	plugins : {
		
		view : edb.SpiritView,
		input : edb.InputTracker,
		output : edb.Output
	},
	
	/*
	 * Helo
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

		/*
		 * TODO: detect sandbox...
		 */
		if ( context === gui.context ) {
			if ( edb.GenericScript && edb.GenericLoader ) { // sandbox!
				edb.GenericScript.set ( edb.Script, "text/edbml" );
				edb.GenericLoader.set ( edb.Loader, "text/edbml" );
			}
		}

		context.Object.model = function ( a1, a2 ) {
			return edb.ObjectModel.extend ( a1, a2 );
		}
		context.Array.model = function ( a1, a2 ) {
			return edb.ArrayModel.extend ( a1, a2 );
		}
		context.Map.model = function ( a2, a2 ) {
			return edb.MapModel.extend ( a1, a2 );
		}
	}
});