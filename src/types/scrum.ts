/**
 * Scrum Development Type Definitions
 *
 * Type definitions for Story Mapping and Scrum workflow
 * (Extracted from DirectorAI.ts for reuse in LangGraph nodes)
 */

/**
 * ストーリーマッピング生成結果
 */
export interface StoryMappingResult {
  storyMapping: StoryMapping;
  markdown: string;
}

/**
 * ストーリーマッピングの型定義
 */
export interface StoryMapping {
  persona: {
    name: string;
    role: string;
    goal: string;
    painPoints?: string[];
  };
  epics: Epic[];
}

export interface Epic {
  id: string;
  title: string;
  description?: string;
  priority: number;
  stories: UserStory[];
}

export interface UserStory {
  id: string;
  title: string;
  asA: string;
  iWantTo: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: number;
  estimatedPoints: number;
}
