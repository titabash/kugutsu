/**
 * Design Documents View Component
 *
 * Displays design documentation including overall, UI/UX, database, and interface designs
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useAppStore } from '../store/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const DesignDocsView: React.FC = () => {
  const designDocs = useAppStore((state) => state.designDocs);

  if (!designDocs) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Design Documents Available</CardTitle>
            <CardDescription>
              Design documents have not been created yet. Run the Scrum development workflow to generate them.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <Card>
        <CardHeader>
          <CardTitle>Design Documents</CardTitle>
          <CardDescription>
            Comprehensive design documentation for the project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overall" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger
                value="overall"
                data-testid="tab-overall"
                aria-selected={undefined}
              >
                Overall
              </TabsTrigger>
              <TabsTrigger
                value="uiux"
                data-testid="tab-uiux"
                aria-selected={undefined}
              >
                UI/UX
              </TabsTrigger>
              <TabsTrigger
                value="database"
                data-testid="tab-database"
                aria-selected={undefined}
              >
                Database
              </TabsTrigger>
              <TabsTrigger
                value="interfaces"
                data-testid="tab-interfaces"
                aria-selected={undefined}
              >
                Interfaces
              </TabsTrigger>
            </TabsList>

            {/* Overall Design Tab */}
            <TabsContent value="overall" data-testid="tab-content">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div data-testid="overall-design" className="prose prose-sm max-w-none">
                    <div data-testid="markdown-content">
                      <ReactMarkdown>{designDocs.overall}</ReactMarkdown>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* UI/UX Design Tab */}
            <TabsContent value="uiux" data-testid="tab-content">
              <Card>
                <CardHeader>
                  <CardTitle>UI/UX Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div data-testid="uiux-design" className="prose prose-sm max-w-none">
                    <ReactMarkdown>{designDocs.uiux.wireframes}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Database Design Tab */}
            <TabsContent value="database" data-testid="tab-content">
              <Card>
                <CardHeader>
                  <CardTitle>Database Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div data-testid="database-design" className="prose prose-sm max-w-none">
                    <ReactMarkdown>{designDocs.database.erDiagram}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Interfaces Design Tab */}
            <TabsContent value="interfaces" data-testid="tab-content">
              <Card>
                <CardHeader>
                  <CardTitle>Interface Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div data-testid="interfaces-design" className="prose prose-sm max-w-none">
                    <ReactMarkdown>{designDocs.interfaces.apiSpec}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DesignDocsView;
