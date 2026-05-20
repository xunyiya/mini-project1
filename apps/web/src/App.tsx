import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import { AuthProvider } from "./lib/auth-context";
import { BugTicketDetailPage } from "./pages/BugTicketDetailPage";
import { BugTicketFormPage } from "./pages/BugTicketFormPage";
import { BugTicketPage } from "./pages/BugTicketPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PeopleManagementPage } from "./pages/PeopleManagementPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectListPage } from "./pages/ProjectListPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RequirementDetailPage } from "./pages/RequirementDetailPage";
import { RequirementFormPage } from "./pages/RequirementFormPage";
import { RequirementListPage } from "./pages/RequirementListPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";
import { WorkflowTemplatesPage } from "./pages/WorkflowTemplatesPage";
import { RequireAuth } from "./routes/RequireAuth";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="requirements" element={<RequirementListPage />} />
              <Route path="requirements/new" element={<RequirementFormPage mode="new" />} />
              <Route path="requirements/:id" element={<RequirementDetailPage />} />
              <Route path="requirements/:id/edit" element={<RequirementFormPage mode="edit" />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="projects" element={<ProjectListPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage />} />
              <Route path="projects/:id/board" element={<ProjectDetailPage />} />
              <Route path="tasks" element={<MyTasksPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route
                path="meetings"
                element={<PlaceholderPage title="会议纪要" moduleKey="meetings" />}
              />
              <Route path="risks" element={<PlaceholderPage title="风险台账" moduleKey="risks" />} />
              <Route
                path="changes"
                element={<PlaceholderPage title="变更申请" moduleKey="changes" />}
              />
              <Route path="defects" element={<BugTicketPage />} />
              <Route path="defects/:id" element={<BugTicketDetailPage />} />
              <Route path="defects/:id/edit" element={<BugTicketFormPage />} />
              <Route
                path="releases"
                element={<PlaceholderPage title="上线计划" moduleKey="releases" />}
              />
              <Route
                path="notifications"
                element={<PlaceholderPage title="消息中心" moduleKey="notifications" />}
              />
              <Route path="people" element={<PeopleManagementPage />} />
              <Route path="admin/workflow-templates" element={<WorkflowTemplatesPage />} />
              <Route path="admin" element={<PlaceholderPage title="权限配置" moduleKey="admin" />} />
              <Route path="403" element={<ForbiddenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
