/*
 * Register module.
 */
edb.EDBModule = gui.module ( "edb", {
	
	/**
	 * CSS selector for currently focused form field.
	 * @TODO: Support links and buttons as well
	 * @type {String}
	 */
	fieldselector : null,

	/*
	 * Extending {gui.Spirit}
	 */
	mixins : {

		/**
		 * @TODO: support accessor and implement as property
		 * @param {String|function} script
		 */
		src : function ( script ) {
			if ( gui.Type.isString ( script )) {
				script = gui.Object.lookup ( script );	
			}
			if ( gui.Type.isFunction ( script )) {
				this.script.load ( script );
			} else {
				throw new TypeError ();
			}
		},
		
		/**
		 * Called whenever the EDBML script was evaluated.
		 * @param {TODOTHING} summary
		 */
		onrender : function ( summary ) {},

		/**
		 * Handle changes.
		 * @param {Array<edb.ObjectChange|edb.ArrayChange>}
		 */
		onchange : function ( changes ) {},

		/**
		 * Handle input.
		 * @param {edb.Input} input
		 */
		oninput : function ( input ) {},

		/**
		 * Handle directed input. Setup to require 
		 * the input listener be to be added first.
		 * @see {edb.InputPlugin}
		 * @TODO: when to destruct the type?
		 */
		$oninput : function ( input ) {
			this.input.match ( input );
		}
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
		[ ".gui-script", "edb.ScriptSpirit" ]
	],
	
	/* 
	 * @param {Window} context
	 */
	oncontextinitialize : function ( context ) {
		var plugin, proto, method;
		/*
		 * @TODO: Nasty hack to circumvent that we 
		 * hardcode "event" into inline poke events, 
		 * this creates an undesired global variable.
		 */
		if ( !context.event ) {
			try {
				context.event = null;
			} catch ( ieexception ) {}
		}
		if ( !context.gui.portalled ) {
			if (( plugin = context.gui.AttConfigPlugin )) {
				proto = plugin.prototype;
				method = proto.$evaluate;
				proto.$evaluate = function ( name, value, fix ) {
					if ( gui.Type.isString ( value ) && value.startsWith ( "edb.get" )) {
						var key = gui.KeyMaster.extractKey ( value )[ 0 ];
						value = key ? context.edb.get ( key ) : key;
					}
					return method.call ( this, name, value, fix );
				};
			}
		}
	},

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
		while ( elm && elm.nodeType === Node.ELEMENT_NODE ) {
			if ( hasid ( elm )) {
				parts.push ( "#" + elm.id );
				elm = null;
			} else {
				if ( elm.localName === "body" ) {
					parts.push ( "body" );
					elm = null;
				} else {
					index = gui.DOMPlugin.ordinal ( elm ) + 1;
					parts.push ( ">" + elm.localName + ":nth-child(" + index + ")" );
					elm = elm.parentNode;
				}
			}
		}
		return parts.reverse ().join ( "" );
	}

});