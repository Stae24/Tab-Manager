import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { Virtualizer } from '@tanstack/react-virtual';
import { TabCard } from './TabCard';
import { VIRTUAL_ROW_GAP_PX } from '../constants';
import { Tab as TabType, UniversalId } from '../types';

export interface SearchResultListProps {
    isSearching: boolean;
    displayTabs: TabType[];
    searchQuery: string;
    searchVirtualizer: Virtualizer<HTMLDivElement, Element>;
    handleTabClick: (id: UniversalId) => void;
    saveToVault: (tab: TabType) => void;
    isCreatingIsland: boolean;
    creatingTabId: UniversalId | null;
}

export const SearchResultList: React.FC<SearchResultListProps> = ({
    isSearching,
    displayTabs,
    searchQuery,
    searchVirtualizer,
    handleTabClick,
    saveToVault,
    isCreatingIsland,
    creatingTabId,
}) => {
    if (isSearching) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40">
                <Loader2 size={32} className="mb-4 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
                    Searching...
                </p>
            </div>
        );
    }

    if (displayTabs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 opacity-40">
                <Search size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-center">
                    No tabs found
                    {searchQuery && <><br />for "{searchQuery}"</>}
                </p>
            </div>
        );
    }

    return (
        <div
            className="search-mode-enter relative"
            style={{ height: `${searchVirtualizer.getTotalSize()}px`, width: '100%' }}
        >
            {searchVirtualizer.getVirtualItems().map((virtualRow) => {
                const tab = displayTabs[virtualRow.index];
                if (!tab) return null;

                return (
                    <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={searchVirtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                            paddingBottom: `${VIRTUAL_ROW_GAP_PX}px`,
                        }}
                        className="search-mode-enter"
                    >
                        <TabCard
                            tab={tab}
                            onClick={() => handleTabClick(tab.id)}
                            onSave={() => saveToVault(tab)}
                            disabled={!!searchQuery}
                            isLoading={isCreatingIsland && creatingTabId === tab.id}
                        />
                    </div>
                );
            })}
        </div>
    );
};
