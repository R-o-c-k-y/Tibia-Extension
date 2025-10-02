// https://www.tibia.com/community/?subtopic=worlds
// https://www.tibia.com/community/?subtopic=worlds&order=level_desc&world=Wintera

{
	'use strict';

	const elWorlds = document.getElementById('worlds');
	const titleElement = document.querySelector('.Text');
	const isWorldDetailPage = (
		elWorlds &&
		titleElement &&
		titleElement.textContent == 'World Selection'
		// If the title is some other value, then this might be the entry page; no
		// world has been selected yet.
		// https://www.tibia.com/community/?subtopic=worlds
	);

        const enableWorldSorting = function(container) {
                const tables = container.querySelectorAll('table');
                each(tables, function(table) {
                        const headerRow = Array.from(table.querySelectorAll('tr')).find(function(row) {
                                if (!row.cells.length) {
                                        return false;
                                }
                                const texts = Array.from(row.cells, function(cell) {
                                        return normalizeSpaces(cell.textContent).trim().toLowerCase();
                                });
                                return texts.includes('world') && texts.includes('online');
                        });
                        if (!headerRow) {
                                return;
                        }
                        const headerCells = Array.from(headerRow.cells);
                        const nameIndex = headerCells.findIndex(function(cell) {
                                return /world/i.test(normalizeSpaces(cell.textContent));
                        });
                        const playersIndex = headerCells.findIndex(function(cell) {
                                return /online/i.test(normalizeSpaces(cell.textContent));
                        });
                        if (nameIndex == -1 || playersIndex == -1) {
                                return;
                        }

                        let dataRows = Array.from(table.querySelectorAll('tr')).filter(function(row) {
                                if (row === headerRow || row.cells.length <= playersIndex) {
                                        return false;
                                }
                                if (row.classList.contains('LabelH')) {
                                        return false;
                                }
                                if (row.classList.contains('Odd') || row.classList.contains('Even')) {
                                        return true;
                                }
                                const nameCell = row.cells[nameIndex];
                                return !!(nameCell && normalizeSpaces(nameCell.textContent).trim());
                        });
                        if (!dataRows.length) {
                                return;
                        }

                        const parent = dataRows[0].parentNode;
                        if (!parent) {
                                return;
                        }

                        each(dataRows, function(row, index) {
                                row.dataset.originalOrder = index;
                        });

                        let sortKey;
                        let sortDirection = 1;
                        const buttons = [];

                        const getWorldName = function(row) {
                                const cell = row.cells[nameIndex];
                                if (!cell) {
                                        return '';
                                }
                                const anchor = cell.querySelector('a');
                                if (anchor) {
                                        return normalizeSpaces(anchor.textContent).trim();
                                }
                                return normalizeSpaces(cell.textContent).trim();
                        };

                        const getPlayersOnline = function(row) {
                                const cell = row.cells[playersIndex];
                                if (!cell) {
                                        return 0;
                                }
                                const text = normalizeSpaces(cell.textContent).replace(/,/g, '');
                                const match = text.match(/-?\d+/);
                                return match ? Number(match[0]) : 0;
                        };

                        const updateZebraClasses = function() {
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
                                if (key === 'name') {
                                        const worldA = getWorldName(a);
                                        const worldB = getWorldName(b);
                                        const result = worldA.localeCompare(worldB, undefined, {sensitivity: 'base'});
                                        if (result) {
                                                return result;
                                        }
                                } else if (key === 'players') {
                                        const playersA = getPlayersOnline(a);
                                        const playersB = getPlayersOnline(b);
                                        if (playersA !== playersB) {
                                                return playersA - playersB;
                                        }
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
                                updateZebraClasses();
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

                        createSortButton(headerCells[nameIndex], 'name', 'world name');
                        createSortButton(headerCells[playersIndex], 'players', 'players online');
                        updateButtons();
                });
        };

        if (isWorldDetailPage) {
                const cells = document.querySelectorAll('.Table2 :is(.Odd, .Even)');
                each(cells, function(element) {
                        element.classList.add('mths-tibia-block-links');
                });
                cells[0].querySelector('a').focus();
                enableWorldSorting(elWorlds);
        }
}
