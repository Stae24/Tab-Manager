import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Settings,
  Palette,
  ZoomIn,
  Layout,
  ToggleLeft,
  Volume2,
  VolumeX,
  Snowflake,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Minus,
  Plus as PlusIcon,
  Layers,
  MinusCircle,
  Type,
  AlignLeft,
  MousePointer,
  Sparkles,
  Box,
  MoreHorizontal,
  Cloud,
  HardDrive,
  ArrowUp,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useStore, defaultAppearanceSettings } from '../store/useStore';
import type { ThemeMode, AnimationIntensity, AudioIndicatorMode, BorderRadius, ButtonSize, IconPack, MenuPosition, FaviconSource, FaviconFallback, FaviconSize } from '../store/useStore';

type TabId = 'general' | 'display' | 'tabs' | 'groups' | 'vault' | 'advanced';

// Section types for collapsible settings
interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

// Custom Toggle Switch component
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-lg transition-all border",
        checked
          ? "bg-gx-accent/10 border-gx-accent/30"
          : "bg-gx-gray border-white/5 hover:border-gx-accent/20"
      )}
    >
      <div
        className={cn(
          "w-11 h-6 rounded-full p-1 flex items-center transition-all duration-300",
          checked ? "bg-gx-accent justify-end" : "bg-gx-gray justify-start"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded-full shadow-lg transition-all duration-300",
          checked ? "bg-white shadow-gx-accent/50" : "bg-gray-400"
        )} />
      </div>
      {(label || description) && (
        <div className="flex-1 text-left">
          {label && (
            <span className={cn(
              "text-xs font-bold block",
              checked ? "text-gx-accent" : "text-gray-300"
            )}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-[10px] text-gray-500 block mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </button>
  );
};

// Custom Slider component
const SliderControl: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  displayValue?: string;
}> = ({ value, onChange, min, max, step, label, displayValue }) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        {displayValue && (
          <span className="text-xs font-mono text-gx-accent bg-gx-accent/10 px-2 py-0.5 rounded">
            {displayValue}
          </span>
        )}
      </div>
      <div className="relative h-3 bg-gx-gray/50 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-gradient-to-r from-gx-accent to-gx-red transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
        />
        {/* Visible thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border border-white/20 z-0 pointer-events-none transition-all duration-150"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
};

// Custom Dropdown component with portal
const DropdownSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: React.ElementType }[];
  label: string;
}> = ({ value, onChange, options, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();

      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      const handleScroll = () => {
        updatePosition();
      };

      const handleResize = () => {
        updatePosition();
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, updatePosition]);

  return (
    <div className="space-y-2">
      <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => {
            if (!isOpen) {
              updatePosition();
            }
            setIsOpen(!isOpen);
          }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gx-gray border border-white/5 rounded-lg hover:border-gx-accent/30 transition-all"
        >
          <div className="flex items-center gap-2">
            {selectedOption?.icon && <selectedOption.icon size={14} className="text-gx-accent" />}
            <span className="text-xs text-gray-200">{selectedOption?.label}</span>
          </div>
          <ChevronDown size={12} className={cn("text-gray-500 transition-transform", isOpen && "rotate-180")} />
        </button>
        {isOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[9999] bg-gx-dark border border-gx-accent/20 rounded-lg shadow-xl overflow-hidden"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all",
                    option.value === value
                      ? "bg-gx-accent/10 text-gx-accent"
                      : "text-gray-400 hover:bg-gx-accent/20 hover:text-gray-200"
                  )}
                >
                  {option.icon && <option.icon size={14} className="opacity-80" />}
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
};

// Color Palette component
const ColorPalette: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const colors = [
    { name: 'GX Accent', value: 'gx-accent', color: '#7f22fe' },
    { name: 'GX Red', value: 'gx-red', color: '#ff1b1b' },
    { name: 'GX Cyan', value: 'gx-cyan', color: '#00d4ff' },
    { name: 'GX Green', value: 'gx-green', color: '#00ff88' },
    { name: 'Custom', value: 'custom', color: 'linear-gradient(135deg, #7f22fe 0%, #ff1b1b 100%)' },
  ];

  return (
    <div className="space-y-2">
      <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase block">{label}</span>
      <div className="grid grid-cols-5 gap-2">
        {colors.map((color) => (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            className={cn(
              "w-full aspect-square rounded-lg border-2 transition-all hover:scale-105 hover:shadow-lg",
              value === color.value
                ? "border-gx-accent ring-2 ring-gx-accent/50"
                : "border-transparent hover:border-white/20"
            )}
            style={{ background: color.color }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
};

// Collapsible Section component
const CollapsibleSection: React.FC<{
  id: string;
  title: string;
  icon: React.ElementType;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ id, title, icon: Icon, isExpanded, onToggle, children }) => {
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden bg-gx-gray/30">
      <button
        onClick={() => onToggle()}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all"
      >
        <Icon size={16} className="text-gx-accent" />
        <span className="flex-1 text-left text-sm font-bold text-gray-200">{title}</span>
        <div className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
          <ChevronDown size={14} className="text-gray-500" />
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 pt-2">
          {children}
        </div>
      )}
    </div>
  );
};

export const AppearanceSettingsPanel: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const appearanceSettings = useStore(state => state.appearanceSettings);
  const setAppearanceSettings = useStore(state => state.setAppearanceSettings);
  const vaultQuota = useStore(state => state.vaultQuota);
  const setVaultSyncEnabled = useStore(state => state.setVaultSyncEnabled);
  const settingsPanelWidth = useStore(state => state.settingsPanelWidth);
  const setSettingsPanelWidth = useStore(state => state.setSettingsPanelWidth);

  const [activeTab, setActiveTab] = useState<TabId>('display');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['display', 'tabs']));
  const [isClosing, setIsClosing] = useState(false);

  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(settingsPanelWidth);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(settingsPanelWidth);
  const isResizingRef = useRef(false);
  const currentWidthRef = useRef<number>(settingsPanelWidth);

  const [showLabels, setShowLabels] = useState(true);
  const [shouldWrapTabs, setShouldWrapTabs] = useState(false);

  useEffect(() => {
    if (!isResizing) {
      setPanelWidth(settingsPanelWidth);
    }
  }, [settingsPanelWidth, isResizing]);

  useEffect(() => {
    const fitPanelToWindow = () => {
      const windowWidth = window.innerWidth;
      const minGap = 50;
      const maxAllowedWidth = windowWidth - minGap;
      
      if (panelWidth > maxAllowedWidth) {
        const newWidth = Math.max(320, maxAllowedWidth);
        setPanelWidth(newWidth);
        setSettingsPanelWidth(newWidth);
      }
    };

    if (isOpen) {
      fitPanelToWindow();
    }
  }, [isOpen, panelWidth, setSettingsPanelWidth]);

  useEffect(() => {
    const handleWindowResize = () => {
      const windowWidth = window.innerWidth;
      const minGap = 50;
      const maxAllowedWidth = windowWidth - minGap;
      
      if (panelWidth > maxAllowedWidth) {
        const newWidth = Math.max(320, maxAllowedWidth);
        setPanelWidth(newWidth);
        setSettingsPanelWidth(newWidth);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [panelWidth, setSettingsPanelWidth]);

  useEffect(() => {
    if (panelWidth >= 550) {
      setShowLabels(true);
      setShouldWrapTabs(false);
    } else {
      setShowLabels(true);
      setShouldWrapTabs(true);
    }
  }, [panelWidth]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizingRef.current = true;
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
    currentWidthRef.current = panelWidth;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    
    const deltaX = resizeStartX.current - e.clientX;
    const newWidth = resizeStartWidth.current + deltaX;
    
    const clampedWidth = Math.max(320, Math.min(800, newWidth));
    
    const maxAllowedWidth = window.innerWidth - 50;
    const finalWidth = Math.min(clampedWidth, maxAllowedWidth);
    
    setPanelWidth(finalWidth);
    currentWidthRef.current = finalWidth;
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (!isResizingRef.current) return;
    
    isResizingRef.current = false;
    setIsResizing(false);
    setSettingsPanelWidth(currentWidthRef.current);
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [setSettingsPanelWidth, handleResizeMove]);

  const tabs = [
    { id: 'display' as TabId, label: 'Display', icon: Monitor },
    { id: 'tabs' as TabId, label: 'Tabs', icon: Layout },
    { id: 'groups' as TabId, label: 'Groups', icon: Layers },
    { id: 'vault' as TabId, label: 'Vault', icon: Box },
    { id: 'general' as TabId, label: 'General', icon: Settings },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Filter settings by search
  const filterSettings = (category: string) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return category.toLowerCase().includes(query);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Slide-over Panel with resize handle */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "fixed right-0 top-0 bg-gx-dark border-l border-gx-gray z-50 flex flex-col transition-transform duration-300 ease-out shadow-2xl",
          !isOpen && "translate-x-full",
          isClosing && "transition-transform duration-200"
        )}
        style={{
          width: `${panelWidth}px`,
          transform: isOpen 
            ? `scale(${appearanceSettings.settingsScale})` 
            : `scale(${appearanceSettings.settingsScale}) translateX(100%)`,
          transformOrigin: 'top right',
          height: `${100 / appearanceSettings.settingsScale}%`
        }}
      >
        {/* Resize handle on the left edge */}
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize z-[60] transition-all",
            isResizing && "bg-gx-accent/20"
          )}
        />

        <div className="flex items-center gap-3 px-5 py-4 border-b border-gx-gray bg-gx-gray/50">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gx-accent to-gx-red flex items-center justify-center shadow-lg shadow-gx-accent/30 flex-shrink-0">
            <Settings className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1 relative group">
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              searchQuery ? "text-gx-accent" : "text-gray-500 group-focus-within:text-gx-accent"
            )} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className={cn(
                "w-full pl-10 pr-10 py-2.5 bg-gx-gray/50 border border-white/5 rounded-lg text-sm text-white placeholder-gray-600 outline-none transition-all",
                "focus:border-gx-accent/40 focus:ring-1 focus:ring-gx-accent/20"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gx-red/20 rounded transition-all"
              >
                <X size={12} className="text-gray-500 hover:text-gx-red" />
              </button>
            )}
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gx-red/20 text-gray-400 hover:text-gx-red transition-all flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Responsive Tabs Section */}
        <div className="px-5 py-3 border-b border-gx-gray bg-gx-gray/30">
          <div className={cn(
            "flex justify-center gap-1",
            shouldWrapTabs ? "flex-col" : "flex-row"
          )}>
            {!shouldWrapTabs ? (
              <div className="flex justify-center gap-1 w-full">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold tracking-wider whitespace-nowrap",
                      activeTab === tab.id
                        ? "bg-gx-accent/10 text-gx-accent border border-gx-accent/30"
                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <tab.icon size={14} />
                    <span className="uppercase">{tab.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-1">
                  {tabs.slice(0, 3).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold tracking-wider whitespace-nowrap",
                        activeTab === tab.id
                          ? "bg-gx-accent/10 text-gx-accent border border-gx-accent/30"
                          : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <tab.icon size={14} />
                      <span className="uppercase">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center gap-1">
                  {tabs.slice(3, 5).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-xs font-bold tracking-wider whitespace-nowrap",
                        activeTab === tab.id
                          ? "bg-gx-accent/10 text-gx-accent border border-gx-accent/30"
                          : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <tab.icon size={14} />
                      <span className="uppercase">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth overscroll-none scrollbar-hide">
          {activeTab === 'display' && filterSettings('Display') && (
            <>
              {/* Theme */}
              <CollapsibleSection
                id="theme"
                title="Theme Mode"
                icon={Monitor}
                isExpanded={expandedSections.has('theme')}
                onToggle={() => toggleSection('theme')}
              >
                <DropdownSelect
                  value={appearanceSettings.theme}
                  onChange={(value) => setAppearanceSettings({ theme: value as ThemeMode })}
                  options={[
                    { value: 'dark', label: 'Dark Mode', icon: Moon },
                    { value: 'light', label: 'Light Mode', icon: Sun },
                    { value: 'system', label: 'System Default', icon: Monitor },
                  ]}
                  label="Select Theme"
                />
              </CollapsibleSection>

              {/* UI Scale */}
              <CollapsibleSection
                id="ui-scale"
                title="UI Scale"
                icon={ZoomIn}
                isExpanded={expandedSections.has('ui-scale')}
                onToggle={() => toggleSection('ui-scale')}
              >
                <div className="space-y-4">
                  <SliderControl
                    value={appearanceSettings.uiScale}
                    onChange={(value) => setAppearanceSettings({ uiScale: value })}
                    min={0.5}
                    max={2}
                    step={0.05}
                    label="Interface Scale"
                    displayValue={`${Math.round(appearanceSettings.uiScale * 100)}%`}
                  />
                  <SliderControl
                    value={appearanceSettings.settingsScale}
                    onChange={(value) => setAppearanceSettings({ settingsScale: value })}
                    min={0.5}
                    max={2}
                    step={0.05}
                    label="Settings Panel Scale"
                    displayValue={`${Math.round(appearanceSettings.settingsScale * 100)}%`}
                  />
                </div>
              </CollapsibleSection>

              {/* Accent Color */}
              <CollapsibleSection
                id="accent-color"
                title="Accent Color"
                icon={Palette}
                isExpanded={expandedSections.has('accent-color')}
                onToggle={() => toggleSection('accent-color')}
              >
                <ColorPalette
                  value={appearanceSettings.accentColor}
                  onChange={(value) => setAppearanceSettings({ accentColor: value })}
                  label="Choose Accent Color"
                />
              </CollapsibleSection>

              {/* Border Radius */}
              <CollapsibleSection
                id="border-radius"
                title="Border Radius"
                icon={Box}
                isExpanded={expandedSections.has('border-radius')}
                onToggle={() => toggleSection('border-radius')}
              >
                <DropdownSelect
                  value={appearanceSettings.borderRadius}
                  onChange={(value) => setAppearanceSettings({ borderRadius: value as BorderRadius })}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'small', label: 'Small (4px)' },
                    { value: 'medium', label: 'Medium (8px)' },
                    { value: 'large', label: 'Large (12px)' },
                    { value: 'full', label: 'Full (16px)' },
                  ]}
                  label="Corner Style"
                />
              </CollapsibleSection>
            </>
          )}

          {activeTab === 'tabs' && filterSettings('Tabs') && (
            <>
              {/* Tab Density */}
              <CollapsibleSection
                id="tab-density"
                title="Tab Density"
                icon={Layout}
                isExpanded={expandedSections.has('tab-density')}
                onToggle={() => toggleSection('tab-density')}
              >
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'minified', label: 'Minified', icon: MinusCircle },
                    { value: 'compact', label: 'Compact', icon: Minus },
                    { value: 'normal', label: 'Normal', icon: Layers },
                    { value: 'spacious', label: 'Spacious', icon: PlusIcon },
                  ].map((density) => (
                    <button
                      key={density.value}
                      onClick={() => setAppearanceSettings({ tabDensity: density.value as any })}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                        appearanceSettings.tabDensity === density.value
                          ? "bg-gx-cyan/10 border-gx-cyan/50"
                          : "bg-gx-gray border-white/5 hover:border-gx-cyan/30"
                      )}
                    >
                      <density.icon size={20} className={cn(
                        appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                      )} />
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        appearanceSettings.tabDensity === density.value ? "text-gx-cyan" : "text-gray-500"
                      )}>
                        {density.label}
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Show Favicons */}
              <CollapsibleSection
                id="favicons"
                title="Favicons"
                icon={Sparkles}
                isExpanded={expandedSections.has('favicons')}
                onToggle={() => toggleSection('favicons')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.showFavicons}
                  onChange={(checked) => setAppearanceSettings({ showFavicons: checked })}
                  label="Show Tab Favicons"
                  description="Display website icons next to tab titles"
                />
                <div className="mt-4 space-y-4">
                  <DropdownSelect
                    value={appearanceSettings.faviconSource}
                    onChange={(value) => setAppearanceSettings({ faviconSource: value as FaviconSource })}
                    options={[
                      { value: 'google', label: 'Google (32px)' },
                      { value: 'google-hd', label: 'Google HD (128px)' },
                      { value: 'duckduckgo', label: 'DuckDuckGo' },
                      { value: 'icon-horse', label: 'Icon Horse' },
                      { value: 'chrome', label: 'Chrome Extension' },
                    ]}
                    label="Primary Source"
                  />
                  <DropdownSelect
                    value={appearanceSettings.faviconSize}
                    onChange={(value) => setAppearanceSettings({ faviconSize: value as FaviconSize })}
                    options={[
                      { value: '16', label: '16px (Small)' },
                      { value: '32', label: '32px (Normal)' },
                      { value: '64', label: '64px (Large)' },
                      { value: '128', label: '128px (Extra Large)' },
                    ]}
                    label="Icon Size"
                  />
                  <DropdownSelect
                    value={appearanceSettings.faviconFallback}
                    onChange={(value) => setAppearanceSettings({ faviconFallback: value as FaviconFallback })}
                    options={[
                      { value: 'none', label: 'None (disabled)' },
                      ...(appearanceSettings.faviconSource !== 'google' ? [{ value: 'google', label: 'Google (32px)' }] : []),
                      ...(appearanceSettings.faviconSource !== 'google-hd' ? [{ value: 'google-hd', label: 'Google HD (128px)' }] : []),
                      ...(appearanceSettings.faviconSource !== 'duckduckgo' ? [{ value: 'duckduckgo', label: 'DuckDuckGo' }] : []),
                      ...(appearanceSettings.faviconSource !== 'icon-horse' ? [{ value: 'icon-horse', label: 'Icon Horse' }] : []),
                      ...(appearanceSettings.faviconSource !== 'chrome' ? [{ value: 'chrome', label: 'Chrome Extension' }] : []),
                    ]}
                    label="Fallback Source"
                  />
                </div>
              </CollapsibleSection>

              {/* Show Active Indicator */}
              <CollapsibleSection
                id="active-indicator"
                title="Active Tab Indicator"
                icon={CheckCircle2}
                isExpanded={expandedSections.has('active-indicator')}
                onToggle={() => toggleSection('active-indicator')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.showActiveIndicator}
                  onChange={(checked) => setAppearanceSettings({ showActiveIndicator: checked })}
                  label="Show Active Glow"
                  description="Highlight the currently active tab with a glow effect"
                />
              </CollapsibleSection>

              {/* Show Audio Indicators */}
              <CollapsibleSection
                id="audio-indicators"
                title="Audio Indicators"
                icon={Volume2}
                isExpanded={expandedSections.has('audio-indicators')}
                onToggle={() => toggleSection('audio-indicators')}
              >
                <DropdownSelect
                  value={appearanceSettings.showAudioIndicators}
                  onChange={(value) => setAppearanceSettings({ showAudioIndicators: value as AudioIndicatorMode })}
                  options={[
                    { value: 'off', label: 'Hidden', icon: VolumeX },
                    { value: 'playing', label: 'Only when Playing', icon: Volume2 },
                    { value: 'muted', label: 'Only when Muted', icon: VolumeX },
                    { value: 'both', label: 'Show Both', icon: Volume2 },
                  ]}
                  label="Display Logic"
                />
              </CollapsibleSection>

              {/* Show Frozen Indicators */}
              <CollapsibleSection
                id="frozen-indicators"
                title="Frozen Indicators"
                icon={Snowflake}
                isExpanded={expandedSections.has('frozen-indicators')}
                onToggle={() => toggleSection('frozen-indicators')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.showFrozenIndicators}
                  onChange={(checked) => setAppearanceSettings({ showFrozenIndicators: checked })}
                  label="Show Frozen Status"
                  description="Show snowflake icon for discarded (sleeping) tabs"
                />
              </CollapsibleSection>
            </>
          )}

          {activeTab === 'groups' && filterSettings('Groups') && (
            <>
              {/* Compact Group Headers */}
              <CollapsibleSection
                id="group-headers"
                title="Group Headers"
                icon={Layers}
                isExpanded={expandedSections.has('group-headers')}
                onToggle={() => toggleSection('group-headers')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.compactGroupHeaders}
                  onChange={(checked) => setAppearanceSettings({ compactGroupHeaders: checked })}
                  label="Compact Headers"
                  description="Use smaller headers for tab groups to save space"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="tab-count"
                title="Tab Count"
                icon={Type}
                isExpanded={expandedSections.has('tab-count')}
                onToggle={() => toggleSection('tab-count')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.showTabCount}
                  onChange={(checked) => setAppearanceSettings({ showTabCount: checked })}
                  label="Show Tab Count"
                  description="Display the number of tabs in each group header"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="sort-groups"
                title="Sort Groups"
                icon={ArrowUp}
                isExpanded={expandedSections.has('sort-groups')}
                onToggle={() => toggleSection('sort-groups')}
              >
                <ToggleSwitch
                  checked={appearanceSettings.sortGroupsByCount}
                  onChange={(checked) => setAppearanceSettings({ sortGroupsByCount: checked })}
                  label="Sort Live Groups by Tab Count"
                  description="When enabled, Live Workspace groups are sorted from most to least tabs"
                />
                <div className="h-2" />
                <ToggleSwitch
                  checked={appearanceSettings.sortVaultGroupsByCount}
                  onChange={(checked) => setAppearanceSettings({ sortVaultGroupsByCount: checked })}
                  label="Sort Vault Groups by Tab Count"
                  description="When enabled, Neural Vault groups are sorted from most to least tabs"
                />
              </CollapsibleSection>
            </>
          )}

          {activeTab === 'vault' && filterSettings('Vault') && (
            <>
              <CollapsibleSection
                id="vault-sync"
                title="Cloud Sync"
                icon={Cloud}
                isExpanded={expandedSections.has('vault-sync')}
                onToggle={() => toggleSection('vault-sync')}
              >
                <div className="space-y-4">
                  <ToggleSwitch
                    checked={appearanceSettings.vaultSyncEnabled}
                    onChange={async (checked) => {
                      await setVaultSyncEnabled(checked);
                    }}
                    label="Sync Vault Across Devices"
                    description={
                      appearanceSettings.vaultSyncEnabled
                        ? "Vault syncs via Chrome/Opera account (100KB limit)"
                        : "Vault stored locally only (unlimited space)"
                    }
                  />
                  
                  {vaultQuota && (
                    <div className="bg-gx-gray/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 flex items-center gap-2">
                          {appearanceSettings.vaultSyncEnabled ? (
                            <Cloud size={12} className="text-gx-accent" />
                          ) : (
                            <HardDrive size={12} className="text-gray-500" />
                          )}
                          Storage Used
                        </span>
                        <span className={cn(
                          "font-mono",
                          vaultQuota.warningLevel === 'critical' ? "text-gx-red" :
                          vaultQuota.warningLevel === 'warning' ? "text-yellow-400" :
                          "text-gray-300"
                        )}>
                          {(vaultQuota.used / 1024).toFixed(1)} KB / {(vaultQuota.total / 1024).toFixed(0)} KB
                        </span>
                      </div>
                      <div className="relative h-2 bg-gx-dark rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "absolute h-full transition-all duration-300",
                            vaultQuota.warningLevel === 'critical' ? "bg-gx-red" :
                            vaultQuota.warningLevel === 'warning' ? "bg-yellow-500" :
                            "bg-gx-accent"
                          )}
                          style={{ width: `${Math.min(vaultQuota.percentage * 100, 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {Math.round(vaultQuota.percentage * 100)}% used
                        {vaultQuota.warningLevel !== 'none' && (
                          <span className={cn(
                            "ml-2 font-bold uppercase",
                            vaultQuota.warningLevel === 'critical' ? "text-gx-red" : "text-yellow-400"
                          )}>
                            {vaultQuota.warningLevel === 'critical' ? 'Critical' : 'Warning'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </>
          )}

          {activeTab === 'general' && filterSettings('General') && (
            <>
              {/* Animation Intensity */}
              <CollapsibleSection
                id="animations"
                title="Animations"
                icon={Sparkles}
                isExpanded={expandedSections.has('animations')}
                onToggle={() => toggleSection('animations')}
              >
                <DropdownSelect
                  value={appearanceSettings.animationIntensity}
                  onChange={(value) => setAppearanceSettings({ animationIntensity: value as AnimationIntensity })}
                  options={[
                    { value: 'full', label: 'Full Animations' },
                    { value: 'subtle', label: 'Subtle Effects' },
                    { value: 'off', label: 'Animations Off' },
                  ]}
                  label="Animation Style"
                />
              </CollapsibleSection>

              {/* Drag Opacity */}
              <CollapsibleSection
                id="drag-opacity"
                title="Drag Opacity"
                icon={MousePointer}
                isExpanded={expandedSections.has('drag-opacity')}
                onToggle={() => toggleSection('drag-opacity')}
              >
                <SliderControl
                  value={appearanceSettings.dragOpacity}
                  onChange={(value) => setAppearanceSettings({ dragOpacity: value })}
                  min={0.1}
                  max={1}
                  step={0.1}
                  label="Dragged Item Opacity"
                  displayValue={`${Math.round(appearanceSettings.dragOpacity * 100)}%`}
                />
              </CollapsibleSection>

              {/* Loading Spinner Style */}
              <CollapsibleSection
                id="spinner"
                title="Loading Spinner"
                icon={MoreHorizontal}
                isExpanded={expandedSections.has('spinner')}
                onToggle={() => toggleSection('spinner')}
              >
                <DropdownSelect
                  value={appearanceSettings.loadingSpinnerStyle}
                  onChange={(value) => setAppearanceSettings({ loadingSpinnerStyle: value as any })}
                  options={[
                    { value: 'pulse', label: 'Pulse Glow' },
                    { value: 'dots', label: 'Three Dots' },
                    { value: 'bars', label: 'Loading Bars' },
                    { value: 'ring', label: 'Spinning Ring' },
                  ]}
                  label="Spinner Animation"
                />
              </CollapsibleSection>

              {/* Icon Pack */}
              <CollapsibleSection
                id="icons"
                title="Icon Pack"
                icon={Type}
                isExpanded={expandedSections.has('icons')}
                onToggle={() => toggleSection('icons')}
              >
                <DropdownSelect
                  value={appearanceSettings.iconPack}
                  onChange={(value) => setAppearanceSettings({ iconPack: value as IconPack })}
                  options={[
                    { value: 'gx', label: 'GX Gaming' },
                    { value: 'default', label: 'Standard' },
                    { value: 'minimal', label: 'Minimal' },
                  ]}
                  label="Icon Style"
                />
              </CollapsibleSection>

              <CollapsibleSection
                id="button-size"
                title="Button Size"
                icon={MousePointer}
                isExpanded={expandedSections.has('button-size')}
                onToggle={() => toggleSection('button-size')}
              >
                <DropdownSelect
                  value={appearanceSettings.buttonSize}
                  onChange={(value) => setAppearanceSettings({ buttonSize: value as ButtonSize })}
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' },
                  ]}
                  label="UI Action Size"
                />
              </CollapsibleSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gx-gray bg-gx-gray/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gx-green animate-pulse" />
              <span className="text-[10px] text-gray-500 font-mono">
                Settings auto-saved
              </span>
            </div>
            <button
              onClick={() => setAppearanceSettings({ ...defaultAppearanceSettings })}
              className="text-[10px] font-bold text-gray-500 hover:text-gx-red transition-all uppercase tracking-wider"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
