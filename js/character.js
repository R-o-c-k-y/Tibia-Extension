// https://www.tibia.com/community/?subtopic=characters&name=Illja+Mythus
// https://www.tibia.com/community/?subtopic=characters&name=Himmelh%FCpferin

'use strict';

const elCharacters = document.getElementById('characters');

// Enhance the character info page.
if (elCharacters) {

	let currentTable;
	const $table = function(header, callback) {
		const captions = document.querySelectorAll('.CaptionContainer .Text');
		for (const caption of captions) {
			if (caption.textContent === header) {
				const table = caption.closest('.TableContainer').querySelector('table:not(:empty)');
				currentTable = table;
				callback(currentTable);
				return;
			}
		}
	};

	const $cell = function(header, callback) {
		const cells = currentTable.querySelectorAll('td');
		let nextCell;
		let text;
		each(cells, function(cell, index) {
			if (cell.textContent == (header + ':')) {
				nextCell = cells[++index];
				text = nextCell.textContent;
				return false; // break
			}
		});
		if (nextCell && callback) {
			const result = callback(nextCell, text);
			if (result != null) {
				nextCell.innerHTML = result;
			}
		}
		// This is a quick hack to make sure an `HTMLElement` is always returned.
		return nextCell || new Option;
	};

	const fetchOnlineCharacters = function(url) {
		return new Promise(function(resolve, reject) {
			// Can haz timeout in Fetch API? https://github.com/whatwg/fetch/issues/20
			const xhr = new XMLHttpRequest();
			xhr.open('get', url);
			xhr.timeout = XHR_TIMEOUT;
			xhr.onload = function() {
				if (this.status == 200) {
					resolve(this.responseText);
				} else {
					reject();
				}
			};
			xhr.onerror = function() {
				reject();
			};
			xhr.send();
		});
	};

	// Extract character names, levels, and vocations from HTML soup of the form:
	// https://www.tibia.com/community/?subtopic=worlds&order=level_desc&world=Wintera
	const parseOnlineCharacters = function(html) {
		const regex = /<a href="https:\/\/www.tibia.com\/community\/\?subtopic=characters&name=(?:[^"&]+)"\s?>([^<]+)<\/a><\/td><td style="width:10%;"\s?>([0-9]+)<\/td><td style="width:20%;"\s?>([^<]+)<\/td><\/tr>/g;
		const map = new Map();
		for (const match of html.matchAll(regex)) {
			const name = decodeHTML(match[1]);
			const level = Number(match[2]);
			// Track vocation too, in case it changed since the character logged in.
			const vocation = decodeHTML(match[3]);
			map.set(name, {
				level: level,
				vocation: vocation,
			});
		}
		return map;
	};

	// Store a reference to all the player killers in the death list, for later.
	let killerAnchors;
	$table('Character Deaths', function(table) {
		killerAnchors = table.querySelectorAll('a');
	});

	// Improve the character information table.
	$table('Character Information', function() {
		let charCell;
		let charName;
		let charNameEncoded;
		$cell('Name', function(element, text) {
			// Account for “Foo, will be deleted at Oct 1 2012, 17:00:00 CEST”.
			charCell = element;
			charName = normalizeSpaces(text.match(/^([^,(]+(?:,(?! will be deleted at)[^,(]*)*)?/)[0].trim());
			charNameEncoded = encode(charName);
			charCell.onclick = function(event) {
				const target = event.target;
				if (target.matches('.mths-tibia-character-name')) {
					const selection = window.getSelection();
					const range = new Range();
					range.selectNodeContents(target);
					selection.removeAllRanges();
					selection.addRange(range);
				}
			};
			return strip`<span class="mths-tibia-character-name">${ charName }</span>
				${ text.includes('(traded)') ? ' (traded) ' : ' ' }
				<span class="mths-tibia-character-links">(
					<a href="http://www.tibiaring.com/char.php?lang=en
						&amp;c=${ encodeURIComponent(charName) }">PvP history</a>,${ ' ' }
					<a href="https://guildstats.eu/character?nick=${ charNameEncoded }&amp;tab=9">experience history</a>,${ ' ' }
					<a href="https://www.exevopan.com/?mode=history&descending=true&amp;nicknameFilter=${ charNameEncoded }">bazaar history</a>
				)</span>`;
		});
		charCell.querySelector('a').focus();

		// Normalize the URL in the address bar.
		const param = charNameEncoded.replace(/[^\x20-\x7E]/g, function(symbol) {
			return '%' + symbol.charCodeAt().toString(16).toUpperCase();
		});
		const queryString = `?subtopic=characters&name=${ param }`;
		if (!location.search.includes(queryString)) {
			history.replaceState({}, charName, queryString);
		}

		// Store a reference to the vocation cell, for later.
		let vocation;
		let vocationCell;
		$cell('Vocation', function(element, text) {
			vocationCell = element;
			vocation = normalizeSpaces(text);
		});

		// Is the character married?
		$cell('Married to').classList.add('mths-tibia-block-links');

		// Get the character’s world name.
		let world;
		$cell('World', function(element, text) {
			world = text;
			element.classList.add('mths-tibia-block-links');
			return strip`<a href="${ ORIGIN }/community/?subtopic=worlds&amp;
				order=level_desc&amp;world=${ encode(text) }">${ text }</a>`;
		});

		// Store a reference to the level cell, for later.
		let level;
		let levelCell;
		$cell('Level', function(element, text) {
			level = Number(text);
			levelCell = element;
			const {min, max} = calculateLevelShareRange(level);
			levelCell.innerHTML += ` <small>(share range: ${min}\u2013${max})</small>`;
		});

		fetchOnlineCharacters(strip`
			/community/?subtopic=worlds&order=level_desc&world=${ encode(world) }&${ Date.now() }
		`).then(parseOnlineCharacters).then(function(map) {
			const entry = map.get(charName);
			// Update the level if it changed since the character’s last login.
			if (entry) {
				document.querySelector('.mths-tibia-character-name')
					.classList.add('mths-tibia-online');
				const newLevel = entry.level;
				const delta = newLevel - level;
				if (delta) {
					levelCell.textContent = newLevel + ' (' + (delta < 0 ? '' : '+') +
						delta + ' since last login)';
					levelCell.classList.add('mths-tibia-online');
					const {min, max} = calculateLevelShareRange(newLevel);
					levelCell.innerHTML += ` <small>(share range: ${min}\u2013${max})</small>`;
				}
				// Update the vocation if it changed since the character’s last login.
				if (vocation != entry.vocation) {
					vocationCell.textContent = entry.vocation;
					vocationCell.classList.add('mths-tibia-online');
				}
			}
			// Highlight online characters in the death list.
			if (killerAnchors) {
				each(killerAnchors, function(anchor) {
					const name = anchor.textContent.replace(/\xA0/g, ' ');
					const entry = map.get(name);
					if (entry) {
						anchor.classList.add('mths-tibia-online');
					}
				});
			}
		});

		// Get the former world name (if any).
		$cell('Former World', function(element, text) {
			element.classList.add('mths-tibia-block-links');
			return strip`<a href="${ ORIGIN }/community/?subtopic=worlds&amp;
				order=level_desc&amp;world=${ encode(text) }">${ text }</a>`;
		});

		// Append `onlyshowonline` query string parameter to the guild URL.
		// This one cell contains U+00A0 instead of a regular U+0020 space for some
		// reason.
		$cell('Guild\xA0membership', function(element, text) {
			const anchor = element.querySelector('a');
			anchor.protocol = 'https://';
			anchor.host = 'www.tibia.com';
			anchor.search = anchor.search.replace(
				'&page=view',
				`&page=view&world=${ world }`
			) + '&onlyshowonline=0';
		});
	});

	// Handle other characters on the account.
	$table('Characters', function(table) {
		const applyFallbackLinks = function() {
			const cells = table.querySelectorAll('td[style^="width: 20%"]');
			each(cells, function(cell) {
				const text = normalizeSpaces(cell.textContent);
				const match = text.match(/^\d+\.[\xA0\x20]([^\(]+)/);
				const charName = normalizeSpaces(match ? match[1] : text).trim();
				cell.classList.add('mths-tibia-block-links');
				const nobr = document.createElement('nobr');
				const anchor = document.createElement('a');
				anchor.href = `${ ORIGIN }/community/?subtopic=characters&name=${ encode(charName) }`;
				anchor.textContent = text;
				nobr.appendChild(anchor);
				cell.textContent = '';
				cell.appendChild(nobr);
			});
		};

		const rows = Array.from(table.querySelectorAll('tr'));
		const headerRow = rows.find(function(row) {
			if (!row.cells.length) {
				return false;
			}
			const texts = Array.from(row.cells, function(cell) {
				return normalizeSpaces(cell.textContent).trim().toLowerCase();
			});
			return texts.includes('name') && texts.includes('world');
		});
		if (!headerRow) {
			applyFallbackLinks();
			return;
		}

		const headerCells = Array.from(headerRow.cells);
		const nameIndex = headerCells.findIndex(function(cell) {
			return /name/i.test(normalizeSpaces(cell.textContent));
		});
		const worldIndex = headerCells.findIndex(function(cell) {
			return /world/i.test(normalizeSpaces(cell.textContent));
		});
		if (nameIndex == -1 || worldIndex == -1) {
			applyFallbackLinks();
			return;
		}

		let dataRows = rows.filter(function(row) {
			if (row === headerRow || row.cells.length <= worldIndex) {
				return false;
			}
			if (row.classList.contains('LabelH')) {
				return false;
			}
			const nameCell = row.cells[nameIndex];
			const worldCell = row.cells[worldIndex];
			return !!(nameCell && worldCell && normalizeSpaces(nameCell.textContent).trim());
		});
		if (!dataRows.length) {
			applyFallbackLinks();
			return;
		}

		const parent = dataRows[0].parentNode;
		if (!parent) {
			applyFallbackLinks();
			return;
		}

		each(dataRows, function(row, index) {
			row.dataset.originalOrder = index;
			const nameCell = row.cells[nameIndex];
			const rawText = normalizeSpaces(nameCell.textContent);
			const numberMatch = rawText.match(/^(\d+)[\.)]?\s*(.*)$/);
			let remainder = rawText;
			if (numberMatch) {
				remainder = numberMatch[2];
			}
			const nameParts = remainder.match(/^(.*?)(\s*\(.*\))?$/);
			let charName = nameParts ? nameParts[1] : remainder;
			let suffix = nameParts && nameParts[2] ? nameParts[2] : '';
			charName = normalizeSpaces(charName).trim();
			if (!charName) {
				charName = remainder.trim();
			}

			row.dataset.characterNameDisplay = charName;

			nameCell.classList.add('mths-tibia-block-links');
			nameCell.textContent = '';
			const nobr = document.createElement('nobr');
			const indexElement = document.createElement('span');
			indexElement.className = 'mths-tibia-character-index';
			indexElement.textContent = `${ index + 1 }.`;
			nobr.appendChild(indexElement);
			nobr.appendChild(document.createTextNode(' '));
			const anchor = document.createElement('a');
			anchor.href = `${ ORIGIN }/community/?subtopic=characters&name=${ encode(charName) }`;
			anchor.textContent = charName;
			nobr.appendChild(anchor);
			if (suffix) {
				nobr.appendChild(document.createTextNode(suffix));
			}
			nameCell.appendChild(nobr);

			const worldCell = row.cells[worldIndex];
			const worldName = normalizeSpaces(worldCell.textContent).trim();
			row.dataset.characterWorldDisplay = worldName;
			worldCell.classList.add('mths-tibia-block-links');
			worldCell.textContent = '';
			if (worldName) {
				const worldAnchor = document.createElement('a');
				worldAnchor.href = `${ ORIGIN }/community/?subtopic=worlds&order=level_desc&world=${ encode(worldName) }`;
				worldAnchor.textContent = worldName;
				worldCell.appendChild(worldAnchor);
			}
		});

		let sortKey;
		let sortDirection = 1;
		const buttons = [];

		const updateIndexes = function() {
			each(dataRows, function(row, index) {
				const indexElement = row.querySelector('.mths-tibia-character-index');
				if (indexElement) {
					indexElement.textContent = `${ index + 1 }.`;
				}
			});
		};

		const updateZebra = function() {
			each(dataRows, function(row, index) {
				if (row.classList.contains('Odd') || row.classList.contains('Even')) {
					row.classList.remove('Odd', 'Even');
					row.classList.add(index % 2 ? 'Even' : 'Odd');
				}
			});
		};

		const updateButtons = function() {
			each(buttons, function(item) {
				const {element, key, label} = item;
				const isActive = key === sortKey;
				element.setAttribute('aria-pressed', isActive ? 'true' : 'false');
				if (isActive) {
					const directionText = sortDirection === 1 ? 'ascending' : 'descending';
					element.textContent = sortDirection === 1 ? '▲' : '▼';
					element.setAttribute('aria-label', `Sort by ${ label } (${ directionText })`);
					element.title = `Sort by ${ label } (${ directionText })`;
				} else {
					element.textContent = '⇅';
					element.setAttribute('aria-label', `Sort by ${ label }`);
					element.title = `Sort by ${ label }`;
				}
			});
		};

		const compareRows = function(a, b, key) {
			const datasetKey = key === 'name' ? 'characterNameDisplay' : 'characterWorldDisplay';
			const valueA = a.dataset[datasetKey] || '';
			const valueB = b.dataset[datasetKey] || '';
			const result = valueA.localeCompare(valueB, undefined, {sensitivity: 'base'});
			if (result) {
				return result;
			}
			return Number(a.dataset.originalOrder) - Number(b.dataset.originalOrder);
		};

		const sortRows = function(key, direction) {
			sortKey = key;
			sortDirection = direction;
			dataRows.sort(function(a, b) {
				return compareRows(a, b, key) * direction;
			});
			each(dataRows, function(row) {
				parent.appendChild(row);
			});
			updateIndexes();
			updateZebra();
			updateButtons();
		};

		const createSortButton = function(cell, key, label) {
			if (cell.querySelector('.mths-tibia-sort-button')) {
				return;
			}
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'mths-tibia-sort-button';
			button.textContent = '⇅';
			button.setAttribute('aria-label', `Sort by ${ label }`);
			button.title = `Sort by ${ label }`;
			button.addEventListener('click', function() {
				const direction = sortKey === key ? sortDirection * -1 : 1;
				sortRows(key, direction);
			});
			cell.appendChild(button);
			buttons.push({element: button, key, label});
		};

		createSortButton(headerCells[nameIndex], 'name', 'name');
		createSortButton(headerCells[worldIndex], 'world', 'world');
		updateButtons();
	});

	// Make the character search form perform a clean GET.
	each(
		document.querySelectorAll(
			'form[action="https://www.tibia.com/community/?subtopic=characters"]'
		),
		function(form) {
			form.method = 'get';
			const button = form.querySelector('input[name="Submit"]');
			if (button) {
				button.type = 'submit';
				button.removeAttribute('name');
			}
		}
	);

}
