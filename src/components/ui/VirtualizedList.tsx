import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FixedSizeList as List, VariableSizeList } from 'react-window';
import { cn } from '../../lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight?: number | ((index: number) => number);
  height: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
  overscan?: number;
  onItemsRendered?: (info: { visibleStartIndex: number; visibleStopIndex: number }) => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  loadMoreThreshold?: number;
  initialScrollOffset?: number;
  scrollToIndex?: number;
  itemKey?: (index: number, data: T[]) => string | number;
}

// Memoized list item component to prevent unnecessary re-renders
const ListItem = React.memo<{
  index: number;
  style: React.CSSProperties;
  data: {
    items: any[];
    renderItem: (item: any, index: number, style: React.CSSProperties) => React.ReactNode;
  };
}>(({ index, style, data }) => {
  const { items, renderItem } = data;
  const item = items[index];
  
  if (!item) return null;
  
  return (
    <div style={style}>
      {renderItem(item, index, style)}
    </div>
  );
});

function VirtualizedList<T>({
  items,
  itemHeight = 60,
  height,
  renderItem,
  className,
  overscan = 5,
  onItemsRendered,
  onLoadMore,
  isLoading = false,
  loadMoreThreshold = 5,
  initialScrollOffset,
  scrollToIndex,
  itemKey,
}: VirtualizedListProps<T>) {
  const listRef = useRef<List | VariableSizeList>(null);
  const [scrollOffset, setScrollOffset] = useState(initialScrollOffset || 0);

  // Memoize item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    items,
    renderItem,
  }), [items, renderItem]);

  // Handle scroll to index
  useEffect(() => {
    if (scrollToIndex !== undefined && listRef.current) {
      listRef.current.scrollToItem(scrollToIndex, 'smart');
    }
  }, [scrollToIndex]);

  // Handle initial scroll offset
  useEffect(() => {
    if (initialScrollOffset && listRef.current) {
      listRef.current.scrollTo(initialScrollOffset);
    }
  }, [initialScrollOffset]);

  // Handle load more when user scrolls near the top
  const handleItemsRendered = useMemo(() => {
    return (info: { visibleStartIndex: number; visibleStopIndex: number }) => {
      // Call the original callback if provided
      if (onItemsRendered) {
        onItemsRendered(info);
      }

      // Trigger load more when user scrolls near the top
      if (onLoadMore && !isLoading && info.visibleStartIndex <= loadMoreThreshold) {
        onLoadMore();
      }
    };
  }, [onItemsRendered, onLoadMore, isLoading, loadMoreThreshold]);

  // Generate item key function for better performance
  const getItemKey = useMemo(() => {
    if (itemKey) {
      return (index: number) => itemKey(index, items);
    }
    return (index: number) => `item-${index}`;
  }, [itemKey, items]);

  // Use FixedSizeList for consistent heights, VariableSizeList for dynamic heights
  const isVariableHeight = typeof itemHeight === 'function';

  if (items.length === 0) {
    return (
      <div 
        className={cn('flex items-center justify-center text-slate-500 dark:text-slate-400', className)}
        style={{ height }}
      >
        No items to display
      </div>
    );
  }

  if (isVariableHeight) {
    return (
      <VariableSizeList
        ref={listRef as React.RefObject<VariableSizeList>}
        height={height}
        itemCount={items.length}
        itemSize={itemHeight as (index: number) => number}
        itemData={itemData}
        overscanCount={overscan}
        onItemsRendered={handleItemsRendered}
        initialScrollOffset={scrollOffset}
        itemKey={getItemKey}
        className={className}
      >
        {ListItem}
      </VariableSizeList>
    );
  }

  return (
    <List
      ref={listRef as React.RefObject<List>}
      height={height}
      itemCount={items.length}
      itemSize={itemHeight as number}
      itemData={itemData}
      overscanCount={overscan}
      onItemsRendered={handleItemsRendered}
      initialScrollOffset={scrollOffset}
      itemKey={getItemKey}
      className={className}
    >
      {ListItem}
    </List>
  );
}

export default React.memo(VirtualizedList) as typeof VirtualizedList;
