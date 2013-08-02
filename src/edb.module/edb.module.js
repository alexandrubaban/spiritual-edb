/*
 * Register module.
 */
window.edb.EDBModule = gui.module ( "edb", {
	
	/**
	 * CSS selector for currently focused form field.
	 * @TODO: Support links and buttons as well
	 * @TODO: Migrate to (future) EDBMLModule
	 * @type {String}
	 */
	fieldselector : null,

	/*
	 * Extending {gui.Spirit}
	 */
	mixins : {
		
		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {},

		/**
		 * Handle changes.
		 * @param {Array<edb.ObjectChange|edb.ArrayChange>}
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
	],

	/**
	 * Context spiritualized.
	 * @param {Window} context
	 */
	onafterspiritualize : function ( context ) {
		var doc = context.document;
		if ( gui.Client.isGecko ) { // @TODO: patch in Spiritual?
			doc.addEventListener ( "focus", this, true );
			doc.addEventListener ( "blur", this, true );
		} else {
			doc.addEventListener ( "focusin", this, true );
			doc.addEventListener ( "focusout", this, true );
		}
		
	},

	/**
	 * Handle event.
	 * @param {Event} e
	 */
	handleEvent : function ( e ) {
		switch ( e.type ) {
			case "focusin" :
			case "focus" :
				this.fieldselector = this._fieldselector ( e.target );
				break;
			case "focusout" :
			case "blur" :
				this.fieldselector = null;
				break;
		}
	},


	// Private ...................................................

	/**
	 * Compute selector for form field. We scope it to 
	 * nearest element ID or fallback to document body.
	 * @param {Element} element
	 */
	_fieldselector : function ( elm ) {
		var index = -1;
		var parts = [];
		function hasid ( elm ) {
			if ( elm.id ) {
				try {
					gui.DOMPlugin.q ( elm.parentNode, elm.id );
					return true;
				} catch ( malformedexception ) {}
			}
			return false;
		}
		while ( elm !== null ) {
			if ( hasid ( elm )) {
				parts.push ( "#" + elm.id );
				elm = null;
			} else {
				index = gui.DOMPlugin.ordinal ( elm ) + 1;
				parts.push ( ">" + elm.localName + ":nth-child(" + index + ")" );
				elm = elm.parentNode;
			}
		}
		return parts.reverse ().join ( "" );
	}

});