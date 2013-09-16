/**
 * It's the update manager.
 * @param {gui.Spirit} spirit
 */
edb.UpdateManager = function UpdateManager ( spirit ) {
	this._keyid = spirit.dom.id () || spirit.$instanceid;
	this._spirit = spirit;
	this._doc = spirit.document;
};

edb.UpdateManager.prototype = {
	
	/**
	 * Update.
	 * @param {String} html
	 */
	update : function ( html ) {
		this._updates = new edb.UpdateCollector ();
		this._functions = {};
		if ( !this._olddom ) {
			this._first ( html );
		} else {
			this._next ( html );
			this._updates.collect ( 
				new edb.FunctionUpdate ( this._doc ).setup ( 
					this._keyid, 
					this._functions 
				)
			);
		}
		this._updates.eachRelevant ( function ( update ) {
			update.update ();
			update.dispose ();
		});
		//this._fisse ( this._functions );
		//edb.FunctionUpdate.remap ( this._spirit, this._functions );
		if ( this._updates ) { // huh? how can it be null?
			this._updates.dispose ();
		}
		delete this._updates;
	},
	
	
	// PRIVATE ..............................................................

	/**
	 * This can be one of two:
	 * 1) Spirit element ID (if element has ID).
	 * 2) Spirits $instanceid (if no element ID).
	 * @type {String}
	 */
	_keyid : null,

	/**
	 * Spirit document.
	 * @type {Document}
	 */
	_doc : null,

	/**
	 * Associated spirit.
	 * @type {gui.Spirit}
	 */
	_spirit : null,
		
	/**
	 * Current DOM subtree.
	 * @type {Document}
	 */
	_olddom : null,
	
	/**
	 * Incoming DOM subtree.
	 * @type {Document}
	 */
	_nedwdom : null,
	
	/**
	 * List of updates to apply.
	 * @type {[type]}
	 */
	_updates : null,

	/**
	 * Assistant utilities.
	 * @type {edb.UpdateAssistant}
	 */
	_assistant : edb.UpdateAssistant,

	/*
	_fisse : function ( remappings ) {
		var count = 0;
		if ( Object.keys ( remappings ).length ) {
			new gui.Crawler ( "John" ).descend ( this._spirit, {
				handleElement : function ( elm ) {
					Array.forEach ( elm.attributes, function ( att ) {
						var oldkeys = gui.KeyMaster.extractKey ( att.value );
						if ( oldkeys ) {
							var newkey;
							oldkeys.forEach ( function ( oldkey ) {
								if (( newkey = remappings [ oldkey ])) {
									att.value = att.value.replace ( oldkey, newkey );
									edb.Script.$revoke ( oldkey );
									count ++;
								}
							});
						}
					});
				}
			});
		}
		if ( count ) {
			console.debug ( "Updated " + count + " function keys." );
		}
	},
	*/

	/**
	 * First update (always a hard update).
	 * @param {String} html
	 */
	_first : function ( html ) {
		this._olddom = this._parse ( html );
		this._updates.collect ( 
			new edb.HardUpdate ( this._doc ).setup ( this._keyid, this._olddom )
		);
	},

	/**
	 * Next update.
	 * @param {String} html
	 */
	_next : function ( html ) {
		this._newdom = this._parse ( html );
		this._crawl ( this._newdom, this._olddom, this._newdom, this._keyid, {});
		this._olddom = this._newdom;
	},

	/**
	 * Parse markup to element.
	 * @param {String} html
	 * @returns {Element}
	 */
	_parse : function ( html ) {
		return this._assistant.parse ( 
			this._doc, 
			html, 
			this._keyid, 
			this._spirit.element 
		);
	},
	
	/**
	 * Crawl.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_crawl : function ( newchild, oldchild, lastnode, id, ids ) {
		var result = true;
		while ( newchild && oldchild && !this._updates.hardupdates ( id )) {
			switch ( newchild.nodeType ) {
				case Node.TEXT_NODE :
					result = this._check ( newchild, oldchild, lastnode, id, ids );
					break;
				case Node.ELEMENT_NODE :
					result = this._scan ( newchild, oldchild, lastnode, id, ids );
					break;
			}
			newchild = newchild.nextSibling;
			oldchild = oldchild.nextSibling;
		}
		return result;
	},

	/**
	 * Scan elements.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_scan : function ( newnode, oldnode, lastnode, id, ids ) {
		var result = true, oldid = this._assistant.id ( oldnode );
		if (( result = this._check ( newnode, oldnode, lastnode, id, ids )))  {	
			if ( oldid ) {
				ids = gui.Object.copy ( ids );
				lastnode = newnode;
				ids [ oldid ] = true;
				id = oldid;
			}
			result = this._crawl ( newnode.firstChild, oldnode.firstChild, lastnode, id, ids );
		}
		return result;
	},
	
	/**
	 * Hello.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Element} lastnode
	 * @param {String} id
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean}
	 */
	_check : function ( newnode, oldnode, lastnode, id, ids ) {
		var result = true;
		var isSoftUpdate = false;
		var isPluginUpdate = false; // TODO: plugins...
		if (( newnode && !oldnode ) || ( !newnode && oldnode )) {  
			result = false;
		} else if (( result = newnode.nodeType === oldnode.nodeType )) {
			switch ( oldnode.nodeType ) {
				case Node.TEXT_NODE :
					if ( newnode.data !== oldnode.data ) {
						result = false;
					}
					break;
				case Node.ELEMENT_NODE :
					if (( result = this._familiar ( newnode, oldnode ))) {
						if (( result = this._checkatts ( newnode, oldnode, ids ))) {
							if ( this._maybesoft ( newnode, oldnode )) {
								if ( this._confirmsoft ( newnode, oldnode )) {
									this._updatesoft ( newnode, oldnode, ids );
									isSoftUpdate = true; // prevents the replace update
								}
								result = false; // crawling continued in _updatesoft
							} else {
								if ( oldnode.localName !== "textarea" ) { // TODO: better forms support!
									result = newnode.childNodes.length === oldnode.childNodes.length;
									if ( !result && oldnode.id ) {
										lastnode = newnode;
										id = oldnode.id;
									}
								}
							}
						}
					}
					break;
			}
		}
		if ( !result && !isSoftUpdate && !isPluginUpdate ) {
			this._updates.collect ( new edb.FunctionUpdate ( this._doc ).setup ( id ));
			this._updates.collect ( new edb.HardUpdate ( this._doc ).setup ( id, lastnode ));
		}
		return result;
	},

	/**
	 * Roughly estimate whether two elements could be identical.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @returns {boolean}
	 */
	_familiar : function ( newnode, oldnode ) {
		return [ "namespaceURI", "localName" ].every ( function ( prop ) {
			return newnode [ prop ] === oldnode [ prop ];
		});
	},
	
	/**
   * Same id trigges attribute synchronization;
	 * different id triggers hard update of ancestor.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Map<String,boolean>} ids
	 * @returns {boolean} When false, replace "hard" and stop crawling.
	 */
	_checkatts : function ( newnode, oldnode, ids ) {
		var result = true;
		var update = null;
		if ( this._attschanged ( newnode.attributes, oldnode.attributes, ids )) {
			var newid = this._assistant.id ( newnode );
			var oldid = this._assistant.id ( oldnode );
			if ( newid && newid === oldid ) {
				update = new edb.AttsUpdate ( this._doc ).setup ( oldid, newnode, oldnode );
				this._updates.collect ( update, ids );
			} else {
				result = false;
			}
		}
		return result;
	},

	/**
	 * Attributes changed? When an attribute update is triggered by a EDB poke, we verify 
	 * that this was the *only* thing that changed and substitute the default update with 
	 * a edb.FunctionUpdate. This will bypass the need  for an ID attribute on the associated 
	 * element (without which a hardupdate would happen).
	 * @see {edb.FunctionUpdate}
	 * @param {NodeList} newatts
	 * @param {NodeList} oldatts
	 * @param {?} ids
	 * @returns {boolean}
	 */
	_attschanged : function ( newatts, oldatts, ids ) {
		var changed = newatts.length !== oldatts.length;
		if ( !changed ) {
			changed = !Array.every ( newatts, function ischanged ( newatt ) {
				var oldatt = oldatts.getNamedItem ( newatt.name );
				return oldatt && oldatt.value === newatt.value;
			});
			if ( changed ) {
				changed = !Array.every ( newatts, function isfunctionchanged ( newatt ) {
					var oldatt = oldatts.getNamedItem ( newatt.name );
					if ( this._functionchanged ( newatt.value, oldatt.value ) ) {
						return true;
					} else {
						return newatt.value === oldatt.value;
					}
				}, this );
			}
		}
		return changed;
	},

	_functionchanged : function ( newval, oldval ) {
		var newkeys = gui.KeyMaster.extractKey ( newval );
		var oldkeys = gui.KeyMaster.extractKey ( oldval );
		if ( newkeys && oldkeys ) {
			oldkeys.forEach ( function ( oldkey, i ) {
				this._functions [ oldkey ] = newkeys [ i ];
			}, this );
			return true;
		}
		return false;
	},
	
	/**
	 * Are element children candidates for "soft" sibling updates?
	 * 1) Both parents must have the same ID
	 * 2) All children must have a specified ID
	 * 3) All children must be elements or whitespace-only textnodes
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @return {boolean}
	 */
	_maybesoft : function ( newnode, oldnode ) {
		if ( newnode && oldnode ) {
			return newnode.id && newnode.id === oldnode.id && 
				this._maybesoft ( newnode ) && 
				this._maybesoft ( oldnode );
		} else {	
			return Array.every ( newnode.childNodes, function ( node ) {
				var res = true;
				switch ( node.nodeType ) {
					case Node.TEXT_NODE :
						res = node.data.trim () === "";
						break;
					case Node.ELEMENT_NODE :
						res = this._assistant.id ( node ) !== null;
						break;
				}
				return res;
			}, this );
		}
	},

	/**
	 * "soft" siblings can only be inserted and removed. This method verifies that 
	 * elements retain their relative positioning before and after an update. Changing 
	 * the ordinal position of elements is not supported since this might destruct UI 
	 * state (moving eg. an iframe around using DOM methods would reload the iframe). 
	 * TODO: Default support ordering and make it opt-out instead?
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @returns {boolean}
	 */
	_confirmsoft : function ( newnode, oldnode ) {
		var res = true, prev = null;
		var oldorder = this._assistant.order ( oldnode.childNodes );
		return Array.every ( newnode.childNodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				var id = this._assistant.id ( node );
				if ( oldorder.has ( id ) && oldorder.has ( prev )) {
					res = oldorder.get ( id ) > oldorder.get ( prev );
				}
				prev = id;
			}
			return res;
		}, this );
	},
	
	/**
	 * Update "soft" siblings.
	 * @param {Element} newnode
	 * @param {Element} oldnode
	 * @param {Map<String,boolean>} ids
	 * @return {boolean}
	 */
	_updatesoft : function ( newnode, oldnode, ids ) {
		var updates = [];
		var news = this._assistant.index ( newnode.childNodes );
		var olds = this._assistant.index ( oldnode.childNodes );
		/*
		 * Add elements?
		 */
		var child = newnode.lastElementChild,
			topid = this._assistant.id ( oldnode ),
			oldid = null,
			newid = null;
		while ( child ) {
			newid = this._assistant.id ( child );
			if ( !olds [ newid ]) {
				if ( oldid ) {
					updates.push (
						new edb.InsertUpdate ( this._doc ).setup ( oldid, child ) 
					);
				} else {
					updates.push (
						new edb.AppendUpdate ( this._doc ).setup ( topid, child ) 
					);
				}
			} else {
				oldid = newid;
			}
			child = child.previousElementSibling;
		}
		
		/*
		 * Remove elements?
		 */
		Object.keys ( olds ).forEach ( function ( id ) {
			if ( !news [ id ]) {
				updates.push (
					new edb.RemoveUpdate ( this._doc ).setup ( id ) 
				);
				updates.push (
					new edb.FunctionUpdate ( this._doc ).setup ( id ) 
				);
			} else { // note that crawling continues here...
				var n1 = news [ id ];
				var n2 = olds [ id ];
				this._scan ( n1, n2, n1, id, ids );
			}
		}, this );
		
		/*
		 * Register updates
		 */
		updates.reverse ().forEach ( function ( update ) {
			this._updates.collect ( update, ids );
		}, this );
	}
};