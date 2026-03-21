import TruthCoursesSection from './college/TruthCoursesSection';
import './NarrativeBranches.css';

const NarrativeBranches = ({ college }) => {
  return (
    <section className="prestige-section narrative-branches">
      <div className="section-container">
        <div className="glass-card-root courses-card">
          <header className="narrative-header">
            <span className="prestige-subheading">Courses Offered</span>
            <h2 className="prestige-heading">Academic Programs</h2>
            <div className="dossier-stamp">Status: 2026 Curriculum Evaluated</div>
          </header>

          <div className="courses-viewport">
            <TruthCoursesSection collegeId={college.id} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeBranches;
