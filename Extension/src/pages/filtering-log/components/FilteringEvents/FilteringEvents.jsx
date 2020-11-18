/* eslint-disable react/jsx-props-no-spreading */
import React, { useContext, useMemo } from 'react';
import { observer } from 'mobx-react';
import { useTable } from 'react-table';
import { rootStore } from '../../stores/RootStore';

import './filtering-events.pcss';

const FilteringEvents = observer(() => {
    const { logStore } = useContext(rootStore);

    const handleEventClick = (row) => (e) => {
        e.preventDefault();
        logStore.setSelectedEventById(row.eventId);
    };

    // FIXME display element escaped, waits when css hits counter would be fixed
    // TODO color blocked requests, elements, cookies
    const columns = useMemo(() => [
        {
            Header: 'URL',
            // TODO display elements, scripts
            accessor: (props) => {
                const {
                    url,
                    cookieName,
                    cookieValue,
                    element,
                } = props;

                if (cookieName) {
                    return `${cookieName} = ${cookieValue}`;
                }

                // TODO check work of element
                if (element) {
                    return element;
                }

                return url;
            },
        },
        {
            Header: 'Type',
            accessor: (props) => {
                const { type, requestThirdParty } = props;

                console.log(requestThirdParty);

                if (requestThirdParty) {
                    // TODO waits for design
                    return (
                        <>
                            {type}
                            <small>Third party</small>
                        </>
                    );
                }

                return type;
            },
        },
        {
            Header: 'Filtering  rule',
            accessor: 'rule',
        },
        {
            Header: 'Filter',
            accessor: 'filter',
        },
        {
            Header: 'Source',
            accessor: 'source',
        },
    ], []);

    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({ columns, data: logStore.events });

    return (
        <table {...getTableProps()} className="filtering-log">
            <thead>
                {
                    headerGroups.map((headerGroup) => (
                        <tr {...headerGroup.getHeaderGroupProps()}>
                            {
                                headerGroup.headers.map((column) => (
                                    <th {...column.getHeaderProps()}>
                                        {
                                            column.render('Header')
                                        }
                                    </th>
                                ))
                            }
                        </tr>
                    ))
                }
            </thead>
            <tbody {...getTableBodyProps()}>
                {
                    rows.map((row) => {
                        prepareRow(row);
                        return (
                            <tr {...row.getRowProps()} onClick={handleEventClick(row.original)}>
                                {
                                    row.cells.map((cell) => {
                                        return (
                                            <td {...cell.getCellProps()}>
                                                {
                                                    cell.render('Cell')
                                                }
                                            </td>
                                        );
                                    })
                                }
                            </tr>
                        );
                    })
                }
            </tbody>
        </table>
    );
});

export { FilteringEvents };
