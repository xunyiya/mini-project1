import { BrowserRouter, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import { AuthProvider } from "./lib/auth-context";
import { DashboardPage } from "./pages/DashboardPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PeopleManagementPage } from "./pages/PeopleManagementPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
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
              <Route
                path="requirements"
                element={<PlaceholderPage title="需求池" moduleKey="requirements" />}
              />
              <Route
                path="reviews"
                element={<PlaceholderPage title="评审审批" moduleKey="reviews" />}
              />
              <Route
                path="projects"
                element={<PlaceholderPage title="项目空间" moduleKey="projects" />}
              />
              <Route path="tasks" element={<PlaceholderPage title="任务看板" moduleKey="tasks" />} />
              <Route
                path="meetings"
                element={<PlaceholderPage title="会议纪要" moduleKey="meetings" />}
              />
              <Route path="risks" element={<PlaceholderPage title="风险台账" moduleKey="risks" />} />
              <Route
                path="changes"
                element={<PlaceholderPage title="变更申请" moduleKey="changes" />}
              />
              <Route
                path="defects"
                element={<PlaceholderPage title="缺陷处理" moduleKey="defects" />}
              />
              <Route
                path="releases"
                element={<PlaceholderPage title="上线计划" moduleKey="releases" />}
              />
              <Route
                path="notifications"
                element={<PlaceholderPage title="消息中心" moduleKey="notifications" />}
              />
              <Route path="people" element={<PeopleManagementPage />} />
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
