'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import JobRequisitionsTab from './hiring-pipeline/job-requisitions-tab';
import CandidatesTab from './hiring-pipeline/candidates-tab';
import InterviewsTab from './hiring-pipeline/interviews-tab';
import FeedbackTab from './hiring-pipeline/feedback-tab';
import OffersTab from './hiring-pipeline/offers-tab';
import OnboardingTab from './hiring-pipeline/onboarding-tab';
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  Handshake,
  UserCheck,
} from 'lucide-react';

export default function HiringPipelineClient() {
  const [activeTab, setActiveTab] = useState('job-requisitions');

  return (
    <div className="space-y-4 sm:space-y-6 p-1 sm:p-2">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 h-auto">
          <TabsTrigger value="job-requisitions" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Job Reqs</span>
          </TabsTrigger>
          <TabsTrigger value="candidates" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Candidates</span>
          </TabsTrigger>
          <TabsTrigger value="interviews" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Interviews</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2">
            <Handshake className="h-4 w-4" />
            <span className="hidden sm:inline">Offers</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Onboarding</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="job-requisitions" className="mt-4">
          <JobRequisitionsTab />
        </TabsContent>

        <TabsContent value="candidates" className="mt-4">
          <CandidatesTab />
        </TabsContent>

        <TabsContent value="interviews" className="mt-4">
          <InterviewsTab />
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <FeedbackTab />
        </TabsContent>

        <TabsContent value="offers" className="mt-4">
          <OffersTab />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-4">
          <OnboardingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

