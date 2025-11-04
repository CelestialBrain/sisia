import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useState } from 'react';
import { APPLICATION_METADATA } from '@/utils/appContext';

export function LogsInterpretationGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between hover:bg-transparent p-0 h-auto">
              <CardTitle className="flex items-center gap-2 text-left flex-1 break-words">
                <BookOpen className="h-5 w-5 shrink-0" />
                <span className="break-words">How to Interpret These Logs</span>
              </CardTitle>
              {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 shrink-0 ml-2" />}
            </Button>
          </CollapsibleTrigger>
          <CardDescription className="text-justify">
            Understand log entries, application architecture, and debugging context
          </CardDescription>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-6 text-sm">
        <div>
          <h4 className="font-semibold mb-2">Application Overview</h4>
          <p className="text-muted-foreground text-justify break-words">{APPLICATION_METADATA.description}</p>
          <div className="mt-2 space-y-1">
            <p className="break-words"><strong>Frontend:</strong> {APPLICATION_METADATA.architecture.frontend}</p>
            <p className="break-words"><strong>Backend:</strong> {APPLICATION_METADATA.architecture.backend}</p>
            <p className="break-words"><strong>State Management:</strong> {APPLICATION_METADATA.architecture.stateManagement}</p>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">User Modes</h4>
          <div className="space-y-2">
            <div>
              <strong className="text-primary">Guest Mode:</strong>
              <p className="text-muted-foreground text-justify break-words">{APPLICATION_METADATA.architecture.userModes.guest}</p>
            </div>
            <div>
              <strong className="text-primary">Authenticated Mode:</strong>
              <p className="text-muted-foreground text-justify break-words">{APPLICATION_METADATA.architecture.userModes.authenticated}</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Key Entities</h4>
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
            {Object.entries(APPLICATION_METADATA.entities).slice(0, 6).map(([key, entity]) => (
              <div key={key} className="border rounded p-2 bg-background">
                <strong className="text-primary break-words">{entity.name}</strong>
                <p className="text-xs text-muted-foreground mt-1 text-justify break-words">{entity.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Storage Layers</h4>
          <div className="space-y-2">
            {Object.entries(APPLICATION_METADATA.storageLayers).map(([key, layer]) => (
              <div key={key}>
                <strong className="text-primary break-words">{layer.name}:</strong>
                <p className="text-xs text-muted-foreground text-justify break-words">{layer.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Common Operations</h4>
          <div className="space-y-3">
            {Object.entries(APPLICATION_METADATA.commonOperations).map(([key, op]) => (
              <div key={key} className="border-l-2 border-primary pl-3">
                <strong className="text-primary break-words">{op.name}</strong>
                <p className="text-xs text-muted-foreground mt-1 text-justify break-words">{op.description}</p>
                <p className="text-xs mt-1 break-words"><strong>Side Effects:</strong> {op.sideEffects.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Log Categories</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {Object.entries(APPLICATION_METADATA.logCategories).map(([key, description]) => (
              <div key={key} className="break-words">
                <code className="bg-muted px-1 py-0.5 rounded font-mono break-all">{key}</code>
                <p className="text-muted-foreground mt-0.5 text-justify break-words">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Common Terms</h4>
          <div className="space-y-1 text-xs">
            {Object.entries(APPLICATION_METADATA.glossary).slice(0, 8).map(([term, definition]) => (
              <div key={term} className="break-words">
                <code className="bg-muted px-1 py-0.5 rounded font-mono break-all">{term}</code>: <span className="text-justify">{definition}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Reading Log Entries</h4>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            <li className="break-words"><strong>Level Badge:</strong> Severity (INFO, WARN, ERROR, DEBUG)</li>
            <li className="break-words"><strong>Category Badge:</strong> What part of the system generated this log</li>
            <li className="break-words"><strong>Message:</strong> Human-readable description of what happened</li>
            <li className="break-words"><strong>Details:</strong> Technical data (IDs, counts, etc.)</li>
            <li className="break-words"><strong>App Context:</strong> Entity type, operation, storage layer</li>
            <li className="break-words"><strong>Technical Context:</strong> Component, query keys, cache invalidations</li>
            <li className="break-words"><strong>Interpretation:</strong> Why this operation happened and its implications</li>
          </ul>
        </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
